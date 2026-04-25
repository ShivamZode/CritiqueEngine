'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

// 👉 THE NEW TEXT HIGHLIGHTER PARSER
const renderHighlightedText = (text, highlightColor) => {
  if (!text) return null;
  // Splits the text by looking for **something**.
  // Everything inside ** goes into odd-numbered array indexes.
  const parts = text.split(/\*\*(.*?)\*\*/g);
  
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // This is the highlighted word!
      return (
        <span key={i} style={{ color: highlightColor, fontWeight: 900, letterSpacing: '0.5px' }}>
          {part}
        </span>
      );
    }
    // This is normal text
    return <span key={i}>{part}</span>;
  });
};

export default function TutorialOverlay({ steps, onComplete, getShapeScreenPos, onStepChange }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });
  const [domPos, setDomPos] = useState(null);

  useEffect(() => {
    const updateDimensions = () => setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const step = steps?.[currentStep];
  
  // 👉 NEW: DOM Tracking & Engine Syncing!
  useEffect(() => {
    if (!step) return;

    // 1. Tell the engine which step we are on so it can select tools
    if (onStepChange) onStepChange(step);

    // 2. Find the exact screen pixels of the HTML element
    if (step.targetDomId) {
      const el = document.getElementById(step.targetDomId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setDomPos({
          x: rect.left + rect.width / 2, // Center X
          y: rect.top,                   // Top Edge
          bottomEdge: rect.bottom        // Bottom Edge
        });
      }
    } else {
      setDomPos(null);
    }
  }, [currentStep, step, windowDimensions, onStepChange]);

  if (!steps || steps.length === 0 || windowDimensions.width === 0 || !step) return null;

  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) onComplete();
    else setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  // ==========================================
  // 👉 THE PRECISION POSITIONING ENGINE
  // ==========================================
  let positionStyles = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  if (step.targetDomId && domPos) {
    const clampedX = Math.max(150, Math.min(windowDimensions.width - 150, domPos.x));
    
    if (domPos.y > windowDimensions.height / 2) {
      // Element is at bottom (Toolbar). Put box ABOVE.
      positionStyles = { top: `${domPos.y - 15}px`, left: `${clampedX}px`, transform: 'translate(-50%, -100%)' };
    } else {
      // Element is at top (List/Share). Put box BELOW.
      positionStyles = { top: `${domPos.bottomEdge + 15}px`, left: `${clampedX}px`, transform: 'translate(-50%, 0)' };
    }
  } else if (step.targetShapeId && getShapeScreenPos) {
    const screenPos = getShapeScreenPos(step.targetShapeId);
    if (screenPos) {
      const clampedX = Math.max(150, Math.min(windowDimensions.width - 150, screenPos.x));
      if (screenPos.y > windowDimensions.height / 2) {
        positionStyles = { top: `${screenPos.y - 20}px`, left: `${clampedX}px`, transform: 'translate(-50%, -100%)' };
      } else {
        positionStyles = { top: `${screenPos.y + 20}px`, left: `${clampedX}px`, transform: 'translate(-50%, 0)' };
      }
    }
  }

  // 👉 DYNAMIC THEME COLORS (Defaults to Blue if you forget to add one)
  const themeColor = step.themeColor || '#3b82f6';
  const themeShadow = `${themeColor}66`; // Adds 40% opacity hex
  const themeBg = `${themeColor}26`;     // Adds 15% opacity hex

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, pointerEvents: 'none' }}>
      <div 
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.15)', pointerEvents: 'auto' }} 
        onClick={(e) => e.stopPropagation()}
      ></div>

      <div style={{
        position: 'absolute',
        ...positionStyles,
        width: '100%',
        maxWidth: '280px',
        backgroundColor: '#18181b',
        border: `2px solid ${themeColor}`, // 👈 Dynamic Border
        borderRadius: '16px',
        padding: '16px',
        boxShadow: `0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px ${themeShadow}`, // 👈 Dynamic Glow
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'top 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s'
      }}>
        
        {step.gifUrl && (
          <div style={{ width: '100%', backgroundColor: '#09090b', borderRadius: '8px', overflow: 'hidden', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={step.gifUrl} alt="Tutorial" style={{ width: '100%', height: 'auto', maxHeight: '220px', objectFit: 'contain', display: 'block' }} />
          </div>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '16px', fontWeight: 900, lineHeight: '1.2' }}>{step.title}</h3>
            
            {/* 👈 Dynamic Badge Color */}
            <span style={{ fontSize: '9px', color: themeColor, fontWeight: 'bold', backgroundColor: themeBg, padding: '2px 6px', borderRadius: '99px', border: `1px solid ${themeShadow}`, whiteSpace: 'nowrap', marginLeft: '8px' }}>
              {currentStep + 1} / {steps.length}
            </span>
          </div>
          
          {/* 👈 Process the text through our new highlighter! */}
          <p style={{ margin: 0, color: '#d4d4d8', fontSize: '13px', lineHeight: '1.5' }}>
            {renderHighlightedText(step.description, themeColor)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          {currentStep > 0 && <button onClick={handlePrev} style={{ padding: '8px 12px', backgroundColor: '#27272a', color: '#ffffff', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}>◀ Prev</button>}
          
          {/* 👈 Dynamic Button Color */}
          <button 
            onClick={handleNext} 
            style={{ flex: 1, padding: '8px 12px', backgroundColor: themeColor, color: '#ffffff', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: `0 4px 10px ${themeShadow}`, transition: 'filter 0.2s' }} 
            onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.2)'} 
            onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
          >
            {isLastStep ? 'Got it! ✨' : 'Next ▶'}
          </button>
        </div>
      </div>
    </div>
  );
}