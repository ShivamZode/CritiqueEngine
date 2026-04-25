'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom'; // 👉 THE FIX 1: Import createPortal
import { decodeDataImageToShapes } from '@/utils/codec';
import { Flame, X, ZoomIn } from 'lucide-react'; 

const getShapeBoundingBox = (shape) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  if (shape.type === 'rect') {
    minX = 0; maxX = shape.width; minY = 0; maxY = shape.height;
  } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'eraser') {
    const pts = shape.points || [];
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i] < minX) minX = pts[i]; if (pts[i] > maxX) maxX = pts[i];
      if (pts[i+1] < minY) minY = pts[i+1]; if (pts[i+1] > maxY) maxY = pts[i+1];
    }
  } else if (shape.type === 'freehand' && shape.lines) {
    shape.lines.forEach(lineObj => {
      const pts = lineObj.points || [];
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i]; if (pts[i] > maxX) maxX = pts[i];
        if (pts[i+1] < minY) minY = pts[i+1]; if (pts[i+1] > maxY) maxY = pts[i+1];
      }
    });
  }

  if (minX === Infinity) return null;

  const actualW = Math.abs(maxX - minX);
  const actualH = Math.abs(maxY - minY);
  const startX = Math.min(minX, maxX);
  const startY = Math.min(minY, maxY);

  const scaleX = shape.scaleX || 1;
  const scaleY = shape.scaleY || 1;

  return {
    x: (startX * scaleX) + (shape.x || 0),
    y: (startY * scaleY) + (shape.y || 0),
    width: actualW * scaleX,
    height: actualH * scaleY,
    thickness: shape.thickness || 4
  };
};

export default function HeatmapOverlay({ art, critiques, onClose, onArtClick }) {
  const [status, setStatus] = useState('analyzing'); 
  const [progress, setProgress] = useState(0);
  const [finalImage, setFinalImage] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    const buildHeatmap = async () => {
      const allExtractedShapes = [];
      let completed = 0;

      for (let i = 0; i < critiques.length; i++) {
        if (isCancelled) return;
        const crit = critiques[i];
        const url = crit.critiqueImageUrl;

        if (!url) { completed++; continue; }

        try {
          const img = new Image();
          img.crossOrigin = 'Anonymous'; 
          
          const decodedPayload = await new Promise((resolve, reject) => {
            img.onload = () => {
              try { resolve(decodeDataImageToShapes(img)); } 
              catch (e) { reject(new Error("Decoder failed")); }
            };
            img.onerror = () => reject(new Error("ImgBB rejected request"));
            img.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
          });

          let shapeList = typeof decodedPayload === 'string' ? JSON.parse(decodedPayload) : decodedPayload;
          if (shapeList && !Array.isArray(shapeList) && shapeList.shapes) shapeList = shapeList.shapes;
          if (!Array.isArray(shapeList)) shapeList = [];

          shapeList.forEach(shape => allExtractedShapes.push(shape));
        } catch (err) {
          console.error(`⚠️ Heatmap skipped critique ${i}. Reason:`, err.message);
        }

        completed++;
        setProgress(Math.round((completed / critiques.length) * 100));
      }

      if (isCancelled) return;
      setStatus('rendering');

      const bgImg = new Image();
      bgImg.crossOrigin = 'Anonymous';
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve;
        bgImg.onerror = reject;
        bgImg.src = art?.imageUrl + (art?.imageUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
      });

      const w = bgImg.naturalWidth || 1000;
      const h = bgImg.naturalHeight || 1000;

      const heatCanvas = document.createElement('canvas');
      heatCanvas.width = w; heatCanvas.height = h;
      const heatCtx = heatCanvas.getContext('2d', { willReadFrequently: true });
      
      heatCtx.fillStyle = 'rgba(0, 0, 0, 0.15)'; 
      
      allExtractedShapes.forEach(shape => {
        const bbox = getShapeBoundingBox(shape);
        if (!bbox) return;

        const pad = (bbox.thickness / 2) + 2;
        heatCtx.fillRect(bbox.x - pad, bbox.y - pad, bbox.width + (pad * 2), bbox.height + (pad * 2));
      });

      const imgData = heatCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]; 
        
        if (alpha > 0) {
          const density = Math.min(alpha / 150, 1);
          let r, g, b = 0;
          
          if (density <= 0.33) {
            r = Math.floor((density / 0.33) * 255); g = 255;
          } else if (density <= 0.66) {
            r = 255; g = Math.floor(255 - (((density - 0.33) / 0.33) * 127)); 
          } else {
            r = 255; g = Math.floor(128 - (((density - 0.66) / 0.34) * 128)); 
          }

          data[i] = r; data[i + 1] = g; data[i + 2] = b;
          data[i + 3] = Math.floor(120 + (density * 135)); 
        }
      }
      heatCtx.putImageData(imgData, 0, 0);

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = w; finalCanvas.height = h;
      const finalCtx = finalCanvas.getContext('2d');

      finalCtx.drawImage(bgImg, 0, 0, w, h);
      finalCtx.globalAlpha = 0.65; 
      finalCtx.drawImage(heatCanvas, 0, 0, w, h);
      finalCtx.globalAlpha = 1.0;

      if (!isCancelled) {
        const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
        setFinalImage(dataUrl);
        setStatus('complete');
      }
    };

    if (critiques && critiques.length > 0 && art?.imageUrl) {
      buildHeatmap();
    } else {
      setStatus('complete');
    }

    return () => { isCancelled = true; };
  }, [critiques, art]);

  // 👉 THE FIX 2: Teleport the overlay to the document body so it ignores parent z-indexes
  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        @keyframes heatFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes heatZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes heatPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        .heat-overlay { position: fixed; inset: 0; z-index: 9999999; background-color: rgba(0, 0, 0, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); display: flex; flex-direction: column; animation: heatFadeIn 0.3s ease-out; font-family: system-ui, -apple-system, sans-serif; }
        
        .heat-circle-progress { transition: stroke-dashoffset 0.3s ease-out; stroke-linecap: round; }
        
        .heat-image-container { position: relative; width: 100%; max-width: 1200px; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
        
        .heat-image-wrap { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 16px; background-color: rgba(24, 24, 27, 0.8); border-radius: 24px; box-shadow: 0 0 80px rgba(0,0,0,0.6); border: 1px solid rgba(63, 63, 70, 0.5); cursor: pointer; transition: background-color 0.2s; box-sizing: border-box; }
        .heat-image-wrap:hover { background-color: rgba(39, 39, 42, 0.9); }
      `}</style>
      
      <div className="heat-overlay" onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', padding: '24px', zIndex: 50, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.5px' }}>
              <Flame size={28} color="#f97316" /> Attention Heatmap
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '13px', fontWeight: 'bold', margin: '4px 0 0 0' }}>Aggregated visual feedback density</p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            style={{ padding: '10px 20px', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(8px)' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            <X size={16} /> Close
          </button>
        </div>

        {/* CONTENT AREA */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative', overflow: 'hidden' }}>
          
          {status !== 'complete' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', zIndex: 40, backgroundColor: 'rgba(24, 24, 27, 0.5)', padding: '32px', borderRadius: '24px', border: '1px solid #27272a', backdropFilter: 'blur(12px)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'heatZoomIn 0.3s ease-out' }}>
              <div style={{ width: '96px', height: '96px', position: 'relative', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#27272a" strokeWidth="6" fill="transparent" />
                  <circle
                    cx="50" cy="50" r="40" stroke="#ef4444" strokeWidth="6" fill="transparent"
                    strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * progress) / 100}
                    className="heat-circle-progress"
                  />
                </svg>
                <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#ffffff', fontWeight: 900, fontSize: '20px' }}>
                  {status === 'rendering' ? '...' : `${progress}%`}
                </span>
              </div>
              <p style={{ color: '#f87171', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0, animation: 'heatPulse 2s infinite' }}>
                {status === 'rendering' ? 'Fusing Layers...' : 'Decoding Critiques...'}
              </p>
            </div>
          )}

          {/* THE FINAL IMAGE */}
          {status === 'complete' && finalImage && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', minHeight: 0, paddingBottom: '8px', animation: 'heatZoomIn 0.5s ease-out' }}>
              
              <div className="heat-image-container">
                <div className="heat-image-wrap" onClick={() => { onArtClick(finalImage, 'viewer_raw'); onClose(); }}>
                  <img 
                    src={finalImage} 
                    alt="Final Heatmap" 
                    draggable="false"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '16px', display: 'block',
                      pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', backgroundColor: 'rgba(24, 24, 27, 0.8)', padding: '10px 24px', borderRadius: '999px', border: '1px solid #3f3f46', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Low Attention</span>
                <div style={{ width: '160px', height: '10px', borderRadius: '999px', background: 'linear-gradient(to right, rgb(0, 255, 0), rgb(255, 255, 0), rgb(255, 128, 0), rgb(255, 0, 0))', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}></div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High Attention</span>
              </div>

              <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#71717a', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, margin: '12px 0 0 0' }}>
                <ZoomIn size={14} /> Click the image for full view
              </p>
            </div>
          )}

        </div>
      </div>
    </>,
    document.body // The magic portal target
  );
}