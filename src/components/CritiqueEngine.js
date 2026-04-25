'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Circle, Text, Group, Image as KonvaImage, Transformer, Arrow, Path } from 'react-konva';
import { getStroke } from 'perfect-freehand';
import { encodeShapesToDataImage } from '@/utils/codec';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import TutorialOverlay from './TutorialOverlay';
import { uploadToTempService } from '@/utils/tempUpload';
import { 
  ArrowLeft, List, Share2, MoreHorizontal, X, 
  Hand, MousePointer2, Square, Slash, ArrowUpRight, Lasso, PenTool, Eraser,
  Image as ImageIcon, Undo2, Redo2, Copy, Trash2, 
  AlertTriangle, Eye, Sparkles, MessageCircle, Keyboard, Play, GraduationCap, CheckCircle,
  OctagonAlert, Search, RotateCw, UploadIcon
} from 'lucide-react';

const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
};

const generateThumbnail = (fileObj) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;
        if (width <= MAX_SIZE && height <= MAX_SIZE && fileObj.size < 300000) {
          return resolve(e.target.result.split(',')[1]); 
        }
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileObj);
  });
};

const hexToRgba = (hex, opacity) => {
  if (!hex) return null;
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const getShapeBounds = (shape) => {
  let b = { x: 0, y: 0, w: 0, h: 0 };

  if (shape.type === 'rect') {
    b = {
      x: shape.x || 0,
      y: shape.y || 0,
      w: (shape.width || 0) * (shape.scaleX || 1),
      h: (shape.height || 0) * (shape.scaleY || 1),
    };
  } else if (shape.type === 'freehand' && shape.lines) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shape.lines.forEach((lineObj) => {
      const pts = lineObj.points || [];
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i];
        if (pts[i] > maxX) maxX = pts[i];
        if (pts[i + 1] < minY) minY = pts[i + 1];
        if (pts[i + 1] > maxY) maxY = pts[i + 1];
      }
    });
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
    b = {
      x: minX * (shape.scaleX || 1) + (shape.x || 0),
      y: minY * (shape.scaleY || 1) + (shape.y || 0),
      w: (maxX - minX) * (shape.scaleX || 1),
      h: (maxY - minY) * (shape.scaleY || 1),
    };
  } else if (shape.points && shape.points.length >= 2) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < shape.points.length; i += 2) {
      if (shape.points[i] < minX) minX = shape.points[i];
      if (shape.points[i] > maxX) maxX = shape.points[i];
      if (shape.points[i + 1] < minY) minY = shape.points[i + 1];
      if (shape.points[i + 1] > maxY) maxY = shape.points[i + 1];
    }
    b = {
      x: minX * (shape.scaleX || 1) + (shape.x || 0),
      y: minY * (shape.scaleY || 1) + (shape.y || 0),
      w: (maxX - minX) * (shape.scaleX || 1),
      h: (maxY - minY) * (shape.scaleY || 1),
    };
  }

  return { x: b.w < 0 ? b.x + b.w : b.x, y: b.h < 0 ? b.y + b.h : b.y, w: Math.abs(b.w), h: Math.abs(b.h) };
};

const isPointInShape = (px, py, shape) => {
  const scaleX = shape.scaleX || 1;
  const scaleY = shape.scaleY || 1;
  const rotation = (shape.rotation || 0) * Math.PI / 180;
  const dx = px - (shape.x || 0);
  const dy = py - (shape.y || 0);
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = (dx * cos - dy * sin) / scaleX;
  const localY = (dx * sin + dy * cos) / scaleY;

  if (shape.type === 'rect') return localX >= 0 && localX <= (shape.width || 0) && localY >= 0 && localY <= (shape.height || 0);
  else if (shape.points && shape.points.length >= 6) {
    let inside = false;
    const pts = shape.points;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const xi = pts[i], yi = pts[i + 1];
      const xj = pts[j], yj = pts[j + 1];
      const intersect = ((yi > localY) !== (yj > localY)) && (localX < (xj - xi) * (localY - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  return false;
};

const calculateParentId = (newShape, allShapes) => {
  const nBounds = getShapeBounds(newShape);
  const nCenterX = nBounds.x + (nBounds.w / 2);
  const nCenterY = nBounds.y + (nBounds.h / 2);
  const potentialParents = allShapes.filter(s => s.id !== newShape.id && s.type !== 'eraser' && s.type !== 'freehand');
  let bestParentId = null;
  let minArea = Infinity;

  potentialParents.forEach((parent) => {
    const pBounds = getShapeBounds(parent);
    const pArea = pBounds.w * pBounds.h;
    const nArea = nBounds.w * nBounds.h;
    if (pArea > nArea) {
      if (isPointInShape(nCenterX, nCenterY, parent)) {
        if (pArea < minArea) { minArea = pArea; bestParentId = parent.id; }
      }
    }
  });

  return bestParentId;
};

const recalculateAllHierarchies = (currentShapes) => {
  const shapesCopy = currentShapes.map(s => ({ ...s, parentId: null, depth: 0 }));
  shapesCopy.forEach(shape => { if (shape.type !== 'eraser') shape.parentId = calculateParentId(shape, shapesCopy); });
  shapesCopy.forEach(shape => {
    if (shape.type !== 'eraser') {
      let d = 0;
      let curr = shape;
      let visited = new Set();
      while (curr && curr.parentId && !visited.has(curr.id)) {
        visited.add(curr.id);
        curr = shapesCopy.find(s => s.id === curr.parentId);
        if (curr) d++;
      }
      shape.depth = d;
    }
  });
  return shapesCopy;
};

const getScreenCoordinate = (localX, localY, stagePos, stageScale, stageRotation) => {
  const rad = stageRotation * (Math.PI / 180);
  const sx = localX * stageScale;
  const sy = localY * stageScale;
  return {
    x: stagePos.x + (sx * Math.cos(rad)) - (sy * Math.sin(rad)),
    y: stagePos.y + (sx * Math.sin(rad)) + (sy * Math.cos(rad))
  };
};

const MemoizedLabel = React.memo(({ shape, stageScale, opacityOverride = 1 }) => {
  if (!shape.title || shape.type === 'eraser') return null;
  const bounds = getShapeBounds(shape);
  return (
    <Group x={bounds.x} y={bounds.y - (14 / stageScale)} opacity={opacityOverride}>
      <Rect fill="rgba(0,0,0,0.7)" cornerRadius={4 / stageScale} width={(shape.title.length * 8 + 12) / stageScale} height={14 / stageScale} />
      <Text text={shape.title} x={6 / stageScale} y={2 / stageScale} fontSize={10 / stageScale} fill="#3b82f6" fontStyle="bold" />
    </Group>
  );
}, (prev, next) =>
  prev.shape.title === next.shape.title &&
  prev.shape.x === next.shape.x &&
  prev.shape.y === next.shape.y &&
  prev.stageScale === next.stageScale &&
  prev.shape.scaleX === next.shape.scaleX &&
  prev.shape.scaleY === next.shape.scaleY &&
  prev.opacityOverride === next.opacityOverride
);

const MemoizedBadge = React.memo(({ shape, index, isSelected, stageScale, opacityOverride = 1 }) => {
  const bounds = getShapeBounds(shape);
  return (
    <Group id={`badge-${shape.id}`} x={bounds.x - (24 / stageScale)} y={bounds.y - (24 / stageScale)} opacity={opacityOverride}>
      {/* 👉 THE FIX: We put the ID directly on the Circles so the click target has it! */}
      <Circle id={`badge-${shape.id}`} radius={15 / stageScale} fill="transparent" />
      
      <Circle id={`badge-${shape.id}`} radius={12 / stageScale} fill={isSelected ? "#eab308" : "#18181b"} stroke="#3b82f6" strokeWidth={2 / stageScale} shadowColor="black" shadowBlur={3} shadowOpacity={0.5} />
      <Text text={(index + 1).toString()} x={-12 / stageScale} y={-5 / stageScale} width={24 / stageScale} align="center" fontSize={10 / stageScale} fontStyle="bold" fill={isSelected ? "black" : "white"} listening={false} />
    </Group>
  );
}, (prev, next) =>
  prev.shape === next.shape &&
  prev.isSelected === next.isSelected &&
  prev.stageScale === next.stageScale &&
  prev.opacityOverride === next.opacityOverride
);

const MemoizedShape = React.memo(({ shape, isSelected, activeTool, onDragEnd, onTransformEnd, isViewer, opacityOverride = 1 }) => {
  const handleDragStart = (e) => {
    if (e.evt) {
      // 1. Stop dragging if they use two fingers on mobile
      if (e.evt.touches && e.evt.touches.length > 1) e.target.stopDrag();
      
      // 👉 2. THE FIX: Stop dragging if it's Middle Click (1) or Right Click (2)
      if (e.evt.button === 1 || e.evt.button === 2) e.target.stopDrag();
    }
  };
  const canInteract = activeTool === 'select' && !isViewer;

  if (shape.type === 'rect') {
    return <Rect id={shape.id} x={shape.x} y={shape.y} width={shape.width} height={shape.height} scaleX={shape.scaleX || 1} scaleY={shape.scaleY || 1} rotation={shape.rotation || 0} stroke={hexToRgba(shape.color, shape.strokeOpacity)} strokeWidth={shape.thickness || 4} fill={shape.fill ? hexToRgba(shape.fill, shape.fillOpacity) : null} dash={[10, 5]} draggable={canInteract && isSelected} onDragStart={handleDragStart} onDragEnd={(e) => onDragEnd(e, shape.id)} onTransformEnd={(e) => onTransformEnd(e, shape.id)} perfectDrawEnabled={false} shadowEnabled={isSelected} shadowColor="white" shadowBlur={10} hitStrokeWidth={Math.max(40, (shape.thickness || 4) + 20)} listening={activeTool === 'select'} opacity={opacityOverride} />;
  }

  // 👉 PERFECT FREEHAND RENDERING
  if (shape.type === 'freehand') {
    return (
      <Group id={shape.id} x={shape.x || 0} y={shape.y || 0} scaleX={shape.scaleX || 1} scaleY={shape.scaleY || 1} rotation={shape.rotation || 0} draggable={canInteract && isSelected} onDragStart={handleDragStart} onDragEnd={(e) => onDragEnd(e, shape.id)} onTransformEnd={(e) => onTransformEnd(e, shape.id)} opacity={opacityOverride}>
        {(shape.lines || []).map((lineObj, idx) => {
          
          // 1. Convert our flat array [x,y,x,y] into pairs [[x,y], [x,y]]
          const rawPoints = lineObj.points || [];
          const pairedPoints = [];
          for (let i = 0; i < rawPoints.length; i += 2) {
            pairedPoints.push([rawPoints[i], rawPoints[i + 1]]);
          }

          // 2. Generate the beautiful smooth stroke using the Butter Smooth settings
          const strokeOutline = getStroke(pairedPoints, {
            size: lineObj.thickness || shape.thickness || 4,
            smoothing: 0.9,     // Forces curves to be beautifully round
            streamline: 0.5,   // Heavy "lazy mouse" drag to ignore hand jitter
            thinning: 0,       // Tapers the ends dynamically based on speed
            simulatePressure: true
          });

          // 3. Convert to an SVG path string
          const pathData = getSvgPathFromStroke(strokeOutline);
          const fillColor = hexToRgba(lineObj.color || shape.color, lineObj.strokeOpacity ?? shape.strokeOpacity);

          // 4. Return a <Path> using FILL
          return (
            <Path
              key={idx}
              data={pathData}
              fill={fillColor}
              
              // 👉 THE FIX: A massive invisible stroke to catch fat-finger clicks!
              stroke="transparent"
              strokeWidth={Math.max(40, (lineObj.thickness || shape.thickness || 4) + 20)}
              
              perfectDrawEnabled={false}
              shadowEnabled={isSelected}
              shadowColor="white"
              shadowBlur={10}
              listening={activeTool === 'select'}
            />
          );
        })}
      </Group>
    );
  }

  if (shape.type === 'line' || shape.type === 'eraser' || shape.type === 'lasso') {
    return <Line id={shape.id} points={shape.points} x={shape.x || 0} y={shape.y || 0} scaleX={shape.scaleX || 1} scaleY={shape.scaleY || 1} rotation={shape.rotation || 0} stroke={shape.type === 'eraser' ? 'white' : hexToRgba(shape.color, shape.strokeOpacity)} strokeWidth={shape.thickness || 4} fill={(shape.fill && shape.isFinished) ? hexToRgba(shape.fill, shape.fillOpacity) : null} closed={!!shape.closed} lineCap="round" lineJoin="round" tension={shape.type === 'line' ? 0 : 0.5} globalCompositeOperation={shape.type === 'eraser' ? 'destination-out' : 'source-over'} draggable={canInteract && isSelected} onDragStart={handleDragStart} onDragEnd={(e) => onDragEnd(e, shape.id)} onTransformEnd={(e) => onTransformEnd(e, shape.id)} perfectDrawEnabled={false} shadowEnabled={isSelected} shadowColor="white" shadowBlur={10} hitStrokeWidth={Math.max(40, (shape.thickness || 4) + 20)} listening={activeTool === 'select'} opacity={opacityOverride} />;
  }

  if (shape.type === 'arrow') {
    return <Arrow id={shape.id} points={shape.points} x={shape.x || 0} y={shape.y || 0} scaleX={shape.scaleX || 1} scaleY={shape.scaleY || 1} rotation={shape.rotation || 0} stroke={hexToRgba(shape.color, shape.strokeOpacity)} strokeWidth={shape.thickness || 4} fill={hexToRgba(shape.color, shape.strokeOpacity)} pointerLength={shape.thickness * 3} pointerWidth={shape.thickness * 3} draggable={canInteract && isSelected} onDragStart={handleDragStart} onDragEnd={(e) => onDragEnd(e, shape.id)} onTransformEnd={(e) => onTransformEnd(e, shape.id)} perfectDrawEnabled={false} shadowEnabled={isSelected} shadowColor="white" shadowBlur={10} hitStrokeWidth={Math.max(40, (shape.thickness || 4) + 20)} listening={activeTool === 'select'} opacity={opacityOverride} />;
  }

  return null;
}, (prevProps, nextProps) =>
  prevProps.shape === nextProps.shape &&
  prevProps.isSelected === nextProps.isSelected &&
  prevProps.activeTool === nextProps.activeTool &&
  prevProps.isViewer === nextProps.isViewer &&
  prevProps.opacityOverride === nextProps.opacityOverride
);

export default function CritiqueEngine({ initialShapes = [], appMode, onExit, saveMode = 'critique', meta = {}, currentUser }) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const drawingLayerRef = useRef(null);
  const trRef = useRef(null);
  const isErasingRef = useRef(false);
  const [eraserTrail, setEraserTrail] = useState([]); // 👉 Added trail state
  // 👉 NEW: Catch-all listener guarantees trail disappears if mouse/finger lifts anywhere

  // Math to check if point is touching a line segment
  const distToSegment = (p, v, w) => {
    let l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  const cameraActionsRef = useRef({ focusOnShape: null, resetCamera: null });

  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);
  const [uploadWarning, setUploadWarning] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const effectiveAppMode = isPreviewMode ? 'viewer' : appMode;

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageObj, setImageObj] = useState(null);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stageRotation, setStageRotation] = useState(0);

  const [activeTool, setActiveTool] = useState(appMode === 'viewer' ? 'pan' : 'rect');
  const [showProperties, setShowProperties] = useState(false);

  const [brushSize, setBrushSize] = useState(4);
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [strokeOpacity, setStrokeOpacity] = useState(1);
  const [fillColor, setFillColor] = useState('#3b82f6');
  const [fillOpacity, setFillOpacity] = useState(0.5);
  const [fillEnabled, setFillEnabled] = useState(false);

  const rawLoadedShapes = initialShapes.shapes || initialShapes;
  const loadedBgUrl = initialShapes.bgUrl || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=800';

  const processedShapes = rawLoadedShapes.map(s => {
    if (appMode === 'editor' && saveMode === 'critique' && s.artistComment && !s.comment) return s;
    else if (appMode === 'editor' && saveMode === 'critique' && s.comment && !s.artistComment) return { ...s, artistComment: s.comment, comment: '' };
    return s;
  });

  const [shapes, setShapes] = useState(processedShapes);
  const historyRef = useRef([[...processedShapes]]);
  const historyStepRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [activeCommentId, setActiveCommentId] = useState(null);

  const [clipboard, setClipboard] = useState(null);
  const [pasteMenuPos, setPasteMenuPos] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);

  // 👉 NEW: States for the Controls Menu
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isRotationEnabled, setIsRotationEnabled] = useState(false);
  const [isTouchRotationEnabled, setIsTouchRotationEnabled] = useState(true);

  const toggleAndSavePreference = (key, currentState, setter) => {
    const nextState = !currentState;
    setter(nextState); // Update UI instantly
    
    // Save locally
    localStorage.setItem(key, String(nextState));
    
    // Save to Telegram Cloud silently
    const tg = window?.Telegram?.WebApp;
    if (tg && tg.CloudStorage && tg.isVersionAtLeast('6.9')) {
      tg.CloudStorage.setItem(key, String(nextState), () => {});
    }
  };

  // 👉 NEW: The Ghost Click Shield Timer
  const [isTopBarLocked, setIsTopBarLocked] = useState(false);

  useEffect(() => {
    if (isSidebarOpen || isControlsOpen) {
      setIsTopBarLocked(true); // Lock instantly
    } else {
      // Wait 400ms after closing before unlocking!
      const timer = setTimeout(() => setIsTopBarLocked(false), 100); 
      return () => clearTimeout(timer);
    }
  }, [isSidebarOpen, isControlsOpen]);

  const [exportPhase, setExportPhase] = useState(null);
  const [exportError, setExportError] = useState(null);

  const [isLimitReached, setIsLimitReached] = useState(false);
  
  const [isCheckingAccess, setIsCheckingAccess] = useState(appMode === 'editor' && saveMode === 'critique');
  const [alreadyCritiqued, setAlreadyCritiqued] = useState(false);

  // 👉 NEW: Drag-to-expand state for the Presentation Box
  const [presentationPanelHeight, setPresentationPanelHeight] = useState(160);
  const isDraggingPanel = useRef(false);

  // Holds our tutorial flags once they load from Telegram or LocalStorage
  const [tutFlags, setTutFlags] = useState(null); 

  // ==========================================
  // 👉 TUTORIAL DATA & STATE
  // ==========================================
  const [activeTutorialSteps, setActiveTutorialSteps] = useState([]);
  const [highlightedDomId, setHighlightedDomId] = useState(null); // Only declared ONCE!

  const getShapeScreenPos = useCallback((shapeId) => {
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return null;
    const bounds = getShapeBounds(shape);
    const centerX = bounds.x + (bounds.w / 2);
    const centerY = bounds.y + (bounds.h / 2);
    return getScreenCoordinate(centerX, centerY, stagePos, stageScale, stageRotation);
  }, [shapes, stagePos, stageScale, stageRotation]);

  const TOOL_TUTORIALS = [
    { 
      title: "Welcome to Critique Engine! 🎨", 
      description: "Before you dive in, let's take a quick tour of the **tools and features** you'll use to **analyze artwork** and leave visual feedback.", 
      position: "center",
      themeColor: "#3b82f6",
      gifUrl: "https://cdn.svgator.com/images/2022/11/Cactus-party-of-4.gif"
    },
    { 
      title: "The Tool Bar", 
      description: "This is where **all your tools** live. Pick a tool to **start analyzing** the artwork.", 
      targetDomId: "tutorial-toolbar", 
      actionTool: "pan", 
      themeColor: "#3b82f6",
      gifUrl: "https://i.ibb.co/JFW9P2K0/Happy-walking-cat.gif" 
    },
    { 
      title: "Frame Tool", 
      description: "**Draw boxes** to highlight specific areas, like **composition framing** or anatomy errors. A **comment box** will instantly appear for you to share your feedback on that spot!", 
      targetDomId: "tutorial-tool-rect", 
      actionTool: "rect", 
      themeColor: "#3b82f6",
      gifUrl: "https://user-images.githubusercontent.com/14011726/94132137-7d4fc100-fe7c-11ea-8512-69f90cb65e48.gif" 
    },
    { 
      title: "Poly Tool", 
      description: "Click point-by-point to create a **precise, custom shape** around complex areas. **Double-tap** or click your starting point to **close the shape** and open the comment box!", 
      targetDomId: "tutorial-tool-line", 
      actionTool: "line", 
      themeColor: "#3b82f6",
      gifUrl: "https://i.ibb.co/your-poly-gif.gif" 
    },
    { 
      title: "Arrow Tool", 
      description: "**Point out specific details** or show the **flow of movement** and light.", 
      targetDomId: "tutorial-tool-arrow", 
      actionTool: "arrow", 
      themeColor: "#3b82f6",
      gifUrl: "https://i.ibb.co/your-arrow-gif.gif" 
    },
    { 
      title: "Lasso Tool", 
      description: "Quickly **circle any area** for complete freeform highlighting. It behaves just like the Frame tool, but **automatically closes** the moment you lift your finger!", 
      targetDomId: "tutorial-tool-lasso", 
      actionTool: "lasso", 
      themeColor: "#3b82f6",
      gifUrl: "https://i.ibb.co/your-lasso-gif.gif" 
    },
    { 
      title: "Draw Tool", 
      description: "**Freehand drawing** to quickly **circle objects** or sketch ideas.", 
      targetDomId: "tutorial-tool-freehand", 
      actionTool: "freehand", 
      themeColor: "#3b82f6",
      gifUrl: "https://i.ibb.co/your-freehand-gif.gif" 
    },
    { 
      title: "Pencil Mode", 
      description: "When drawing freehand, your strokes **group together**. Tap **'Comment'** when you are done drawing to add your feedback to the group!", 
      targetDomId: "tutorial-freehand-msg", 
      actionTool: "freehand", 
      themeColor: "#3b82f6",
      gifUrl: "https://i.ibb.co/your-pencil-msg-gif.gif" 
    },
    { 
      title: "Eraser Tool", 
      description: "Made a mistake? **Swipe the eraser** over any shape or line to **instantly remove it**.", 
      targetDomId: "tutorial-tool-eraser", 
      actionTool: "eraser", 
      themeColor: "#3b82f6",
      gifUrl: "https://i.ibb.co/your-eraser-gif.gif" 
    }
  ];

  const UI_TUTORIALS = [
    { 
      title: "Number Badges", 
      description: "Every shape gets a **number**. Tap any badge to **open the comment box** for that object! When you publish, these turn into a **step-by-step slideshow**.", 
      position: "center", 
      themeColor: "#a855f7",
      gifUrl: "https://i.ibb.co/your-badge-gif.gif" 
    },
    { 
      title: "Object List", 
      description: "Tap the **List button** to see all your annotations in order, and **edit your comments**.", 
      targetDomId: "tutorial-btn-list", 
      themeColor: "#a855f7",
      gifUrl: "https://i.ibb.co/your-list-gif.gif" 
    },
    { 
      title: "Publish & Share", 
      description: "When you're done, hit the **Share button**. You can **preview your critique** first to see exactly how the artist will view your step-by-step presentation!", 
      targetDomId: "tutorial-btn-share", 
      themeColor: "#a855f7",
      gifUrl: "https://i.ibb.co/your-share-gif.gif" 
    }
  ];

  const GUIDED_TUTORIALS = [
    { 
      title: "🎯 Guided Artwork", 
      description: "You've chosen to critique a **Guided Artwork!** The artist has left **predefined shapes** on the canvas highlighting specific areas where they **want feedback**.", 
      position: "center", 
      themeColor: "#22c55e",
      gifUrl: "https://i.ibb.co/your-guided-intro-gif.gif" 
    },
    { 
      title: "👆 Select & Answer", 
      description: "Use the **Select tool** to tap on any existing shape. A **yellow number badge** will appear above it. Tap that badge to **open the comment box**, read the artist's question, and type your answer!", 
      actionTool: "select", 
      themeColor: "#22c55e",
      gifUrl: "https://i.ibb.co/your-select-badge-gif.gif" 
    },
    { 
      title: "▶ The List Button", 
      description: "Alternatively, tap the **List button**. Clicking an item here will **instantly zoom** to the shape and open its comment box so you can answer them sequentially.", 
      targetDomId: "tutorial-btn-list", 
      themeColor: "#22c55e",
      gifUrl: "https://i.ibb.co/your-list-click-gif.gif" 
    }
  ];

  const GUIDE_CREATION_TUTORIALS = [
    { 
      title: "🎯 Setup a Guided Artwork", 
      description: "You are setting up a **Guided Artwork!** **Draw shapes** over specific parts of your art where you want **focused feedback** from critics.", 
      position: "center", 
      themeColor: "#f97316",
      gifUrl: "https://i.ibb.co/your-guide-creation-intro-gif.gif" 
    },
    { 
      title: "❓ Ask Questions", 
      description: "When you draw a shape, a **comment box** will appear. Use this to **ask questions**, clear up confusions, explain your backstory, or tell critics what you **struggled with** on that specific part.", 
      actionTool: "rect", 
      themeColor: "#f97316",
      gifUrl: "https://i.ibb.co/your-guide-question-gif.gif" 
    },
    { 
      title: "🚀 Publish Your Guide", 
      description: "Once you've highlighted all the areas you want feedback on, hit the **Share Data button** to **publish your artwork**. Critics will now see your questions when they review your piece!", 
      targetDomId: "tutorial-btn-share", 
      themeColor: "#f97316",
      gifUrl: "https://i.ibb.co/your-guide-publish-gif.gif" 
    }
  ];

  const NORMAL_CRITIQUE_TUTORIALS = [
    { 
      title: "✍️ Visual Critique", 
      description: "You are about to write a **Visual Critique**! Use the tools to draw directly on the artwork, **point out details**, and leave constructive feedback.", 
      position: "center", 
      themeColor: "#ef4444", // Red for normal critiques
      gifUrl: "https://i.ibb.co/your-normal-crit-gif.gif" // Replace with your GIF
    }
  ];

  const PRESENTATION_TUTORIALS = [
    { 
      title: "🎬 Presentation Mode", 
      description: "Welcome to the **Presentation Mode**! Sit back and watch the critique unfold step-by-step as the camera pans to highlight specific details.", 
      position: "center", 
      themeColor: "#eab308", // Yellow/Gold for presentation mode
      gifUrl: "https://i.ibb.co/your-presentation-intro-gif.gif" 
    },
    { 
      title: "⏩ Easy Navigation", 
      description: "Tap the **Right half** of your screen to jump to the **next frame**, and the **Left half** to go back to the **previous frame**.", 
      position: "center", 
      themeColor: "#eab308",
      gifUrl: "https://i.ibb.co/your-nav-gif.gif" 
    },
    { 
      title: "🖱️ Mouse Navigation", 
      description: "Using a computer? You can simply **scroll your mouse wheel** up or down to quickly glide to the **next or previous** slide!", 
      position: "center", 
      themeColor: "#eab308",
      gifUrl: "https://i.ibb.co/your-mouse-scroll-gif.gif" 
    },
    { 
      title: "💬 Reading the Feedback", 
      description: "Comments appear in the box below! **White text** is the feedback from the critic. If it's a Guided Artwork, the artist's original question will appear in **Purple text**.", 
      position: "bottom", // Or targetDomId if you have a specific ID for the text box
      themeColor: "#eab308",
      gifUrl: "https://i.ibb.co/your-comment-colors-gif.gif" 
    },
    { 
      title: "🏁 Finishing Up", 
      description: "When the presentation ends, you'll be automatically routed to the **Critique Detail page** where you can leave a like or comment. Tapping **Back** returns you to the main artwork!", 
      position: "center", 
      themeColor: "#eab308",
      gifUrl: "https://i.ibb.co/your-finish-gif.gif" 
    }
  ];

  // 👉 NEW: Global event listener for smooth dragging of the presentation box!
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingPanel.current) return;
      
      // Stop the page from bouncing on mobile Safari!
      if (e.cancelable) e.preventDefault(); 
      
      // Get the Y coordinate (works for both Mouse and Touch)
      const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
      
      // Calculate how tall the box should be (from the bottom of the screen up to the finger)
      const newHeight = window.innerHeight - clientY;
      
      // Clamp it so it doesn't disappear or cover the top buttons! (min 100px, max 80% of screen)
      const clampedHeight = Math.max(120, Math.min(newHeight, window.innerHeight * 0.8));
      
      setPresentationPanelHeight(clampedHeight);
    };

    const handlePointerUp = () => {
      isDraggingPanel.current = false;
    };
    
    // Bind to window so the drag doesn't stutter if they move the mouse too fast
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, []);

  // 👉 NEW: Tool-specific tutorial trigger (Now supports multi-step tool tutorials!)
  const handleToolRightClick = (e, toolName) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Instantly select the tool they right-clicked!
    canvasEvents.changeTool(toolName); 
    const allSearchableSteps = [...TOOL_TUTORIALS, ...GUIDED_TUTORIALS];
    
    // 2. THE MAGIC: Use .filter() instead of .find()
    const toolSteps = allSearchableSteps.filter(step => step.actionTool === toolName);

    if (toolSteps.length > 0) {
      setActiveTutorialSteps(toolSteps);
    }
  };

  // 👉 0. FETCH TUTORIAL & PREFERENCE MEMORY
  useEffect(() => {
    const fetchMemory = () => {
      // Added our two new preference keys to the fetch list!
      const keys = ['tut_tools_done', 'tut_guided_done', 'tut_guide_creation_done', 'tut_normal_critique_done', 'tut_presentation_done', 'pref_wheel_rotation', 'pref_touch_rotation'];
      const tg = window?.Telegram?.WebApp;

      if (tg && tg.CloudStorage && tg.isVersionAtLeast('6.9')) {
        tg.CloudStorage.getItems(keys, (err, values) => {
          if (err) {
            console.error("❌ Telegram Cloud Fetch Error:", err);
            fallbackToLocal();
          } else {
            console.log("✅ Telegram Cloud Loaded:", values);
            setTutFlags({
              tools: values.tut_tools_done === 'true',
              guided: values.tut_guided_done === 'true',
              guideCreation: values.tut_guide_creation_done === 'true',
              normalCritique: values.tut_normal_critique_done === 'true',
              presentation: values.tut_presentation_done === 'true'
            });
            
            // 👉 Apply cloud preferences (if they exist, parse them. Otherwise keep the default 'true')
            if (values.pref_wheel_rotation) setIsRotationEnabled(values.pref_wheel_rotation === 'true');
            if (values.pref_touch_rotation) setIsTouchRotationEnabled(values.pref_touch_rotation === 'true');
          }
        });
      } else {
        console.warn("⚠️ CloudStorage not supported. Falling back to LocalStorage.");
        fallbackToLocal();
      }
    };

    const fallbackToLocal = () => {
      setTutFlags({
        tools: localStorage.getItem('tut_tools_done') === 'true',
        guided: localStorage.getItem('tut_guided_done') === 'true',
        guideCreation: localStorage.getItem('tut_guide_creation_done') === 'true',
        normalCritique: localStorage.getItem('tut_normal_critique_done') === 'true',
        presentation: localStorage.getItem('tut_presentation_done') === 'true'
      });
      
      // 👉 Apply local preferences 
      const localWheel = localStorage.getItem('pref_wheel_rotation');
      if (localWheel) setIsRotationEnabled(localWheel === 'true');
      
      const localTouch = localStorage.getItem('pref_touch_rotation');
      if (localTouch) setIsTouchRotationEnabled(localTouch === 'true');
    };
    
    fetchMemory();
  }, []);

  // 👉 1. THE TRIGGER LOGIC
  useEffect(() => {
    if (!tutFlags) return; // Wait until memory is loaded

    let stepsQueue = [];

    // Extract the shapes first so BOTH modes can check them!
    const rawLoadedShapes = Array.isArray(initialShapes) ? initialShapes : (initialShapes?.shapes || []);
    const validShapes = rawLoadedShapes.filter(s => s.type !== 'eraser');

    // 🎬 SCENARIO A: They are viewing a finished critique
    // Fix: Only trigger if there is at least 1 valid annotation shape!
    if (effectiveAppMode === 'viewer') {
      if (validShapes.length > 0 && !tutFlags.presentation) {
        stepsQueue = [...PRESENTATION_TUTORIALS];
      }
    } 
    // ✍️ SCENARIO B: They are in the editor creating/critiquing
    else if (effectiveAppMode === 'editor') {
      const hasPredefinedShapes = validShapes.length > 0;

      const isGuidedCritique = saveMode === 'critique' && hasPredefinedShapes;
      const isNormalCritique = saveMode === 'critique' && !hasPredefinedShapes;
      const isCreatingGuide = saveMode === 'predefine';

      if (!tutFlags.tools) {
        stepsQueue = [...TOOL_TUTORIALS, ...UI_TUTORIALS];
      }

      if (isGuidedCritique && !tutFlags.guided) {
        stepsQueue = [...stepsQueue, ...GUIDED_TUTORIALS];
      } else if (isCreatingGuide && !tutFlags.guideCreation) {
        stepsQueue = [...stepsQueue, ...GUIDE_CREATION_TUTORIALS];
      } else if (isNormalCritique && !tutFlags.normalCritique) {
        stepsQueue = [...stepsQueue, ...NORMAL_CRITIQUE_TUTORIALS];
      }
    }

    // Push whatever queue we built to the overlay
    if (stepsQueue.length > 0) {
      setActiveTutorialSteps(stepsQueue);
    }
  }, [effectiveAppMode, saveMode, initialShapes, tutFlags]);

  // 👉 2. THE AUTO-SCROLL & SYNC LOGIC
  const handleTutorialStepChange = (step) => {
    setHighlightedDomId(step.targetDomId || null);
    
    if (step.actionTool && canvasEvents?.changeTool) {
      canvasEvents.changeTool(step.actionTool);
    }

    if (step.targetDomId && step.targetDomId.startsWith('tutorial-tool-')) {
      setTimeout(() => {
        const toolbar = document.getElementById('tutorial-toolbar');
        const targetBtn = document.getElementById(step.targetDomId);
        
        if (toolbar && targetBtn) {
          const scrollLeft = targetBtn.offsetLeft - (toolbar.clientWidth / 2) + (targetBtn.clientWidth / 2);
          toolbar.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
      }, 50);
    }
  };

  // 👉 3. THE COMPLETION LOGIC
  const handleTutorialComplete = () => {
    const rawLoadedShapes = Array.isArray(initialShapes) ? initialShapes : (initialShapes?.shapes || []);
    const hasPredefinedShapes = rawLoadedShapes.filter(s => s.type !== 'eraser').length > 0;

    const saveFlag = (key) => {
      localStorage.setItem(key, 'true'); // Always save locally just in case
      const tg = window?.Telegram?.WebApp;
      if (tg && tg.CloudStorage && tg.isVersionAtLeast('6.9')) {
        tg.CloudStorage.setItem(key, 'true', () => {});
      }
    };

    // 👉 THE FIX: Instantly update the live React state so it doesn't trigger again this session!
    setTutFlags(prev => {
      if (!prev) return prev;
      const nextFlags = { ...prev };
      
      if (effectiveAppMode === 'viewer') {
        nextFlags.presentation = true;
      } else if (effectiveAppMode === 'editor') {
        const isGuidedCritique = saveMode === 'critique' && hasPredefinedShapes;
        const isNormalCritique = saveMode === 'critique' && !hasPredefinedShapes;
        const isCreatingGuide = saveMode === 'predefine';

        nextFlags.tools = true;
        if (isGuidedCritique) nextFlags.guided = true;
        if (isCreatingGuide) nextFlags.guideCreation = true;
        if (isNormalCritique) nextFlags.normalCritique = true;
      }
      return nextFlags;
    });

    // 🎬 Save to storage for Presentation Mode
    if (effectiveAppMode === 'viewer') {
      saveFlag('tut_presentation_done');
    } 
    // ✍️ Save to storage for Editor Mode
    else if (effectiveAppMode === 'editor') {
      const isGuidedCritique = saveMode === 'critique' && hasPredefinedShapes;
      const isNormalCritique = saveMode === 'critique' && !hasPredefinedShapes;
      const isCreatingGuide = saveMode === 'predefine';

      saveFlag('tut_tools_done');
      if (isGuidedCritique) saveFlag('tut_guided_done');
      if (isCreatingGuide) saveFlag('tut_guide_creation_done');
      if (isNormalCritique) saveFlag('tut_normal_critique_done');
    }

    setActiveTutorialSteps([]);
    setHighlightedDomId(null);
  };

  // 🛠️ DEV TOOL: Wipe Tutorial Memory
  const resetTutorialMemory = () => {
    const keys = [
      'tut_tools_done', 
      'tut_guided_done', 
      'tut_guide_creation_done', 
      'tut_normal_critique_done',
      'tut_presentation_done' // 👈 Added the new key here
    ];

    keys.forEach(key => localStorage.removeItem(key));

    const tg = window?.Telegram?.WebApp;
    if (tg && tg.CloudStorage) {
      tg.CloudStorage.removeItems(keys, (err, success) => {
        if (err) {
          alert("Failed to wipe Telegram Cloud: " + err);
        } else {
          alert("✅ Memory wiped! Close and reopen the Mini App to see tutorials again.");
        }
      });
    } else {
      alert("✅ Local memory wiped! Refresh to see tutorials again.");
    }
  };
  const validTreeShapes = shapes.filter(s => s.type !== 'eraser');
  const [presentationIndex, setPresentationIndex] = useState(-1);
  const [showCriticAnswer, setShowCriticAnswer] = useState(false);

  const activeCommentShape = shapes.find(s => s.id === activeCommentId);

  // Excalidraw-style Object boundary eraser
  const eraseIntersectingShapes = useCallback((layerX, layerY) => {
    if (layerX === undefined || layerY === undefined) return;

    // Update the visual eraser trail
    setEraserTrail(prev => {
      const next = [...prev, layerX, layerY];
      return next.length > 20 ? next.slice(next.length - 20) : next;
    });

    setShapes((prev) => {
      let hasDeleted = false;
      const next = prev.filter((shape) => {
        if (shape.type === 'eraser') return false; 

        const scaleX = shape.scaleX || 1;
        const scaleY = shape.scaleY || 1;
        const shapeRot = (shape.rotation || 0) * Math.PI / 180;
        
        const dx = layerX - (shape.x || 0);
        const dy = layerY - (shape.y || 0);
        
        const shapeCos = Math.cos(-shapeRot);
        const shapeSin = Math.sin(-shapeRot);
        const shapeLocalX = (dx * shapeCos - dy * shapeSin) / scaleX;
        const shapeLocalY = (dx * shapeSin + dy * shapeCos) / scaleY;

        const threshold = (brushSize + 10) / stageScale;

        let hit = false;
        
        if (shape.type === 'rect') {
          const w = shape.width;
          const h = shape.height;
          const onLeft = Math.abs(shapeLocalX - 0) <= threshold && shapeLocalY >= -threshold && shapeLocalY <= h + threshold;
          const onRight = Math.abs(shapeLocalX - w) <= threshold && shapeLocalY >= -threshold && shapeLocalY <= h + threshold;
          const onTop = Math.abs(shapeLocalY - 0) <= threshold && shapeLocalX >= -threshold && shapeLocalX <= w + threshold;
          const onBottom = Math.abs(shapeLocalY - h) <= threshold && shapeLocalX >= -threshold && shapeLocalX <= w + threshold;
          if (onLeft || onRight || onTop || onBottom) hit = true;
        } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'lasso') {
          const pts = shape.points || [];
          for (let i = 0; i < pts.length - 2; i += 2) {
            if (distToSegment({ x: shapeLocalX, y: shapeLocalY }, { x: pts[i], y: pts[i + 1] }, { x: pts[i + 2], y: pts[i + 3] }) <= threshold) {
              hit = true; break;
            }
          }
          if (!hit && shape.closed && pts.length >= 4) {
            if (distToSegment({ x: shapeLocalX, y: shapeLocalY }, { x: pts[pts.length - 2], y: pts[pts.length - 1] }, { x: pts[0], y: pts[1] }) <= threshold) hit = true;
          }
        } else if (shape.type === 'freehand' && shape.lines) {
          for (const lineObj of shape.lines) {
            const pts = lineObj.points || [];
            for (let i = 0; i < pts.length - 2; i += 2) {
              if (distToSegment({ x: shapeLocalX, y: shapeLocalY }, { x: pts[i], y: pts[i + 1] }, { x: pts[i + 2], y: pts[i + 3] }) <= threshold) {
                hit = true; break;
              }
            }
            if (hit) break;
          }
        }
        
        if (hit) hasDeleted = true;
        return !hit; 
      });

      if (hasDeleted) {
        setSelectedId(curr => next.find(s => s.id === curr) ? curr : null);
        setActiveCommentId(curr => next.find(s => s.id === curr) ? curr : null);
      }
      return next;
    });
  }, [setShapes, stageScale, brushSize, setSelectedId, setActiveCommentId]);

  // 👉 ADD THIS HELPER RIGHT BELOW IT: Gets perfect, lag-free coordinates
  const handleEraseEvent = useCallback((e) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = transform.point(stage.getPointerPosition());
    if (pos) eraseIntersectingShapes(pos.x, pos.y);
  }, [eraseIntersectingShapes]);

  const renderedShapes = [...shapes].sort((a, b) => {
    if (a.type !== 'eraser' && b.type !== 'eraser') {
      const depthA = a.depth || 0;
      const depthB = b.depth || 0;
      if (depthA !== depthB) return depthA - depthB;
      const areaA = getShapeBounds(a).w * getShapeBounds(a).h;
      const areaB = getShapeBounds(b).w * getShapeBounds(b).h;
      return areaB - areaA;
    }
    return parseInt(a.id) - parseInt(b.id);
  });

  const visibleRenderedShapes = effectiveAppMode === 'viewer'
    ? renderedShapes.filter(shape => {
      if (shape.type === 'eraser') return true; 
      
      const seqIndex = validTreeShapes.findIndex(s => s.id === shape.id);
      return seqIndex <= presentationIndex && seqIndex !== -1;
    })
    : renderedShapes;

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [effectiveAppMode]);

  // 👉 UPDATED BLOCK: The Master Verification Gate
  useEffect(() => {
    // 1. If they are in Viewer Mode or Creating a Guide, unlock instantly!
    if (!(appMode === 'editor' && saveMode === 'critique')) {
      setIsCheckingAccess(false);
      return;
    }

    // 2. Wait until the parent component finishes passing down the user data
    if (!currentUser?.id || !meta?.artworkId) return;

    // 3. Ask the server for the VIP pass
    fetch(`/api/critiques?critiquerId=${currentUser.id}&artworkId=${meta.artworkId}&checkLimit=true&_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.isBanned) {
          window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: data.error }));
          onExit(); 
          return; // Leave the screen locked!
        }

        if (data.isAlreadyCritiqued) {
          // 👉 THE FIX: Trigger the custom modal instead of the ugly native alert!
          setAlreadyCritiqued(true);
          setIsCheckingAccess(false); // Turn off the loading spinner so the modal can show
          return; 
        }

        if (data.success && data.count >= 10) {
          setIsLimitReached(true);
        }
        
        // 4. Everything is good! Drop the gate!
        setIsCheckingAccess(false); 
      }).catch(err => {
        console.error("Access check failed:", err);
        setIsCheckingAccess(false); // Drop the gate on error so it doesn't freeze forever
      });
  }, [currentUser, appMode, saveMode, meta, onExit]);

  useEffect(() => {
    if (activeTool !== 'select') setPasteMenuPos(null);
  }, [activeTool]);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const updateAndCommit = useCallback((updaterFn) => {
    setShapes((prevShapes) => {
      const updatedShapes = updaterFn(prevShapes);
      const finalizedShapes = recalculateAllHierarchies(updatedShapes);
      
      const currentStep = historyStepRef.current;
      const lastHistoryState = historyRef.current[currentStep];
      
      if (JSON.stringify(lastHistoryState) === JSON.stringify(finalizedShapes)) {
        return finalizedShapes;
      }

      const newHistory = historyRef.current.slice(0, currentStep + 1);
      newHistory.push(finalizedShapes);
      historyRef.current = newHistory;
      historyStepRef.current = newHistory.length - 1;
      setCanUndo(true);
      setCanRedo(false);
      return finalizedShapes;
    });
  }, []);

  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isErasingRef.current) {
        isErasingRef.current = false;
        setEraserTrail([]);
        updateAndCommit(p => p);
      }
    };
    window.addEventListener('pointerup', handleGlobalEnd);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchend', handleGlobalEnd);
    window.addEventListener('touchcancel', handleGlobalEnd);
    return () => {
      window.removeEventListener('pointerup', handleGlobalEnd);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchend', handleGlobalEnd);
      window.removeEventListener('touchcancel', handleGlobalEnd);
    };
  }, [updateAndCommit]);
  
  const canvasEvents = useCanvasEngine({
    stageScale, stagePos, setStagePos, setStageScale, dimensions, 
    appMode: effectiveAppMode,
    activeTool, setActiveTool, shapes, setShapes, updateAndCommit, setSelectedId, setActiveCommentId,
    brushColor, strokeOpacity, brushSize, fillEnabled, fillColor, fillOpacity, containerRef, setPasteMenuPos,
    onToggleList: () => setIsSidebarOpen(prev => !prev)
  });

  const nextPresentationStep = useCallback(() => {
    if (presentationIndex >= 0 && presentationIndex < validTreeShapes.length) {
      const currentShape = validTreeShapes[presentationIndex];
      if (currentShape.artistComment && currentShape.comment && !showCriticAnswer) {
        setShowCriticAnswer(true);
        return;
      }
    }

    if (presentationIndex < validTreeShapes.length - 1) {
      const nextIdx = presentationIndex + 1;
      setPresentationIndex(nextIdx);
      setShowCriticAnswer(false);

      const targetShape = validTreeShapes[nextIdx];
      if (cameraActionsRef.current.focusOnShape) cameraActionsRef.current.focusOnShape(targetShape.id, true);
      setSelectedId(targetShape.id);
      setActiveCommentId(targetShape.id);
    }
  }, [presentationIndex, validTreeShapes, showCriticAnswer]);

  const prevPresentationStep = useCallback(() => {
    if (presentationIndex >= 0) {
      const currentShape = validTreeShapes[presentationIndex];
      if (currentShape.artistComment && currentShape.comment && showCriticAnswer) {
        setShowCriticAnswer(false);
        return;
      }
    }

    if (presentationIndex > 0) {
      const prevIdx = presentationIndex - 1;
      setPresentationIndex(prevIdx);

      const targetShape = validTreeShapes[prevIdx];
      setShowCriticAnswer(!!targetShape.artistComment && !!targetShape.comment);

      if (cameraActionsRef.current.focusOnShape) cameraActionsRef.current.focusOnShape(targetShape.id, true);
      setSelectedId(targetShape.id);
      setActiveCommentId(targetShape.id);
    } else if (presentationIndex === 0) {
      setPresentationIndex(-1);
      setShowCriticAnswer(false);
      setSelectedId(null);
      setActiveCommentId(null);
      if (cameraActionsRef.current.resetCamera) cameraActionsRef.current.resetCamera();
    }
  }, [presentationIndex, validTreeShapes, showCriticAnswer]);

  const { resetCamera, focusOnShape, cameraHandlers } = useCanvasCamera({
    stageRef, 
    stagePos, setStagePos,
    stageScale, setStageScale,
    stageRotation, setStageRotation,
    dimensions, imageObj, 
    appMode: effectiveAppMode,
    onPresentationStep: (dir) => dir === 'next' ? nextPresentationStep() : prevPresentationStep(),
    canvasEvents, containerRef, setShapes, getShapeBounds,
    activeTool, setActiveTool, isRotationEnabled, isTouchRotationEnabled,
    setSelectedId, setActiveCommentId, selectedId,
    activeCommentId
  });
  useEffect(() => {
    cameraActionsRef.current.focusOnShape = focusOnShape;
    cameraActionsRef.current.resetCamera = resetCamera;
  }, [focusOnShape, resetCamera]);

  const deleteSelectedShape = useCallback(() => {
    if (selectedId) {
      updateAndCommit(prevShapes => prevShapes.filter(s => s.id !== selectedId));
      setSelectedId(null);
      setActiveCommentId(null);
    }
  }, [selectedId, updateAndCommit]);

  const handleCopy = useCallback(() => {
    if (selectedId) {
      const shape = shapes.find(s => s.id === selectedId);
      if (shape) {
        setClipboard(JSON.parse(JSON.stringify(shape)));
      }
    }
  }, [selectedId, shapes]);

  const handlePaste = useCallback((x, y) => {
    if (clipboard) {
      const newShape = { ...clipboard, id: Date.now().toString(), parentId: null };
      
      if (x !== undefined && y !== undefined) {
        const bounds = getShapeBounds(clipboard);
        const dx = x - bounds.x;
        const dy = y - bounds.y;
        
        if (newShape.type === 'line' || newShape.type === 'arrow' || newShape.type === 'freehand' || newShape.type === 'lasso') {
          if (newShape.type === 'freehand' && newShape.lines) {
            newShape.lines = newShape.lines.map(l => ({ ...l, points: (l.points || []).map((p, i) => i % 2 === 0 ? p + dx : p + dy) }));
          } else if (newShape.points) {
            newShape.points = newShape.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy);
          }
          newShape.x = 0; newShape.y = 0;
        } else {
          newShape.x = x;
          newShape.y = y;
        }
      } else {
        if (newShape.type === 'line' || newShape.type === 'arrow' || newShape.type === 'freehand' || newShape.type === 'lasso') {
          if (newShape.type === 'freehand' && newShape.lines) {
            newShape.lines = newShape.lines.map(l => ({ ...l, points: (l.points || []).map((p, i) => i % 2 === 0 ? p + 20 : p + 20) }));
          } else if (newShape.points) {
            newShape.points = newShape.points.map((p, i) => i % 2 === 0 ? p + 20 : p + 20);
          }
        } else {
          newShape.x = (newShape.x || 0) + 20;
          newShape.y = (newShape.y || 0) + 20;
        }
      }
      
      updateAndCommit(prev => [...prev, newShape]);
      setSelectedId(newShape.id);
      setActiveCommentId(newShape.id);
      setPasteMenuPos(null);
    }
  }, [clipboard, updateAndCommit]);

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!loadedBgUrl) return;

    setIsImageLoading(true);

    const img = new window.Image();
    const isBase64 = loadedBgUrl.startsWith('data:');
    const isBlob = loadedBgUrl.startsWith('blob:');

    img.src = (isBase64 || isBlob)
      ? loadedBgUrl
      : loadedBgUrl + (loadedBgUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();

    if (!isBase64 && !isBlob) {
      img.crossOrigin = 'Anonymous';
    }

    img.onload = () => {
      setImageObj(img);
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        const scale = Math.min(w / img.width, h / img.height) * 0.9;
        setStageScale(scale);
        setStagePos({ x: (w - img.width * scale) / 2, y: (h - img.height * scale) / 2 });
      }
      setIsImageLoading(false);
    };

    img.onerror = (err) => {
      console.error("Critique Engine failed to load background image:", err);
      setIsImageLoading(false);
    };
  }, [loadedBgUrl]);

  useEffect(() => {
    if (activeTool === 'select' && selectedId && drawingLayerRef.current && trRef.current) {
      const shape = shapes.find(s => s.id === selectedId);
      
      // 👉 THE FIX: Added 'freehand' and 'lasso' to the allowed types!
      if (shape && (shape.type === 'rect' || shape.type === 'freehand' || shape.type === 'lasso')) {
        const node = drawingLayerRef.current.findOne('#' + selectedId);
        if (node) {
          trRef.current.nodes([node]);
          trRef.current.getLayer().batchDraw();
          return;
        }
      }
    }
    if (trRef.current) trRef.current.nodes([]);
  }, [selectedId, activeTool, shapes]);

  const handleExportClick = () => {
    const validAnnotations = shapes.filter(s => s.type !== 'eraser');
    
    // 👉 Check 1: Must have at least one shape
    if (validAnnotations.length === 0) {
      setUploadWarning(
        saveMode === 'predefine' 
          ? "Please draw at least one highlight on your artwork before publishing your Guide." 
          : "Please add at least one visual annotation before publishing your critique."
      );
      return;
    }

    // 👉 Check 2: At least one shape MUST have text in it
    const hasValidComment = validAnnotations.some(shape => {
      // If setting up a guide, check the artist comment
      if (saveMode === 'predefine') return shape.artistComment && shape.artistComment.trim() !== '';
      // If critiquing, check the normal comment
      return shape.comment && shape.comment.trim() !== '';
    });

    if (!hasValidComment) {
      setUploadWarning(
        saveMode === 'predefine'
          ? "Please add a question or context to at least one of your highlights!"
          : "Please type a written comment on at least one of your annotations!"
      );
      return; 
    }

    // If it passes both checks, open the preview prompt!
    setShowPreviewPrompt(true);
  };

  const executeExport = async () => {
    setExportError(null);
    setSelectedId(null);
    setActiveCommentId(null);
    
    try {
      let finalBgUrl = loadedBgUrl.split('?v=')[0].split('&v=')[0];
      let finalThumbUrl = finalBgUrl;

      // 👉 THE FIX: Concurrent Uploads with Built-in Fallbacks
      if (saveMode === 'predefine' && meta.originalFile) {
        setExportPhase('compressing');
        await new Promise(resolve => setTimeout(resolve, 50)); 

        const freshFile = meta.originalFile;
        const thumbnailBase64 = await generateThumbnail(freshFile);
        
        // 1. Instantly convert the thumbnail Base64 into a File (local memory, extremely fast)
        const base64Response = await fetch(`data:image/jpeg;base64,${thumbnailBase64}`);
        const thumbBlob = await base64Response.blob();
        const thumbFile = new File([thumbBlob], "thumbnail.jpg", { type: 'image/jpeg' });
        
        setExportPhase('uploading_temp');
        
        // 2. BOOM! Upload both files concurrently. 
        // 2 requests total. Safely under the 5 req/2s limit!
        const [tempUrl, thumbTempUrl] = await Promise.all([
          uploadToTempService(freshFile),
          uploadToTempService(thumbFile)
        ]);
        
        setExportPhase('syncing_cloud');
        
        // 3. Send ONLY the URLs to your server. Zero image bytes hit your Next.js backend.
        const syncRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbTempUrl, tempUrl }) // Using our URLs!
        });
        
        const data = await syncRes.json();
        if (!syncRes.ok) throw new Error(data.error || "Cloud sync failed");
        
        finalBgUrl = data.imageUrl;
        finalThumbUrl = data.thumbnailUrl;
      }

      setExportPhase('preparing');
      await new Promise(resolve => setTimeout(resolve, 50)); 

      // 1. Encode the shapes using the permanent ImgBB background URL
      const exportPayload = { version: 2, bgUrl: finalBgUrl, shapes: shapes };
      const base64Data = encodeShapesToDataImage(exportPayload);
      
      // 👉 THE MEMORY SHIELD: Convert Encoded Base64 to a File
      const safeBase64 = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
      const encodedResponse = await fetch(safeBase64);
      const encodedBlob = await encodedResponse.blob();
      const encodedFile = new File([encodedBlob], `critique_layer_${Date.now()}.png`, { type: 'image/png' });

      // 2. Upload the heavy encoded image to Litterbox/File.io
      setExportPhase('uploading_temp'); // Re-using this phase for the UI
      const encodedTempUrl = await uploadToTempService(encodedFile);
      
      setExportPhase('uploading');
      
      // 3. Send ONLY the URL to your Next.js server! 
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encodedTempUrl }) // <-- No Base64 here!
      });
      
      const encodedData = await response.json();
      if (!response.ok) throw new Error(encodedData.error || "ImgBB Upload failed");

      setExportPhase('saving');

      // 👉 1. GRAB THE VIP PASS: Extract the Telegram signature!
      const tgInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';

      if (saveMode === 'predefine') {
        const dbRes = await fetch('/api/artworks', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': tgInitData || '' // 👉 2. INJECT IT HERE!
          },
          body: JSON.stringify({
            telegramId: currentUser.id,
            username: currentUser.username,
            firstName: currentUser.firstName,
            imageUrl: finalBgUrl,
            thumbnailUrl: finalThumbUrl,
            encodedImageUrl: encodedData.url,
            isPredefined: true,
            isAdult: meta.isAdult || false,
            title: meta.title,
            caption: meta.caption,
            categories: meta.categories
          })
        });
        const dbData = await dbRes.json();
        
        // Check for ban errors on Guided Uploads
        if (!dbRes.ok) {
          if (dbRes.status === 403 && dbData.error?.includes('banned')) {
            window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: dbData.error }));
            setExportPhase(null);
            return; // Stop the exit process!
          }
          throw new Error(dbData.error || "Failed to save guided artwork");
        }
      } else {
        const dbResponse = await fetch('/api/critiques', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-telegram-init-data': tgInitData || '' // 👉 3. INJECT IT HERE!
          },
          body: JSON.stringify({
            artworkId: meta.artworkId, 
            originalImageUrl: finalBgUrl, 
            critiquerId: currentUser.id,
            critiquerUsername: currentUser.username,
            critiqueImageUrl: encodedData.url,
            comment: `Critique with ${shapes.filter(s => s.type !== 'eraser').length} annotations`
          })
        });
        const dbData = await dbResponse.json();

        // Check for ban errors on normal Critiques
        if (!dbResponse.ok) {
          if (dbResponse.status === 403 && dbData.error?.includes('banned')) {
            window.dispatchEvent(new CustomEvent('show_ban_alert', { detail: dbData.error }));
            setExportPhase(null);
            return; // Stop the exit process!
          }
          throw new Error(dbData.error || "Failed to save critique");
        }
        
        window.dispatchEvent(new Event('critique_added'));
      }

      onExit();
    } catch (e) {
      console.error(e);
      setExportError(e.message);
    } finally {
      setExportPhase(null);
    }
  };

  // 👉 NEW: Manually trigger the correct tutorial context
  const handleRestartTutorial = () => {
    setIsMoreMenuOpen(false); // Instantly close the dropdown

    let stepsQueue = [];
    const rawLoadedShapes = Array.isArray(initialShapes) ? initialShapes : (initialShapes?.shapes || []);
    const validShapes = rawLoadedShapes.filter(s => s.type !== 'eraser');

    // 🎬 Viewer Mode Replay
    if (effectiveAppMode === 'viewer') {
      if (validShapes.length > 0) {
        stepsQueue = [...PRESENTATION_TUTORIALS];
      } else {
        alert("There are no annotations on this artwork to present yet!");
        return;
      }
    } 
    // ✍️ Editor Mode Replay
    else if (effectiveAppMode === 'editor') {
      const hasPredefinedShapes = validShapes.length > 0;
      const isGuidedCritique = saveMode === 'critique' && hasPredefinedShapes;
      const isNormalCritique = saveMode === 'critique' && !hasPredefinedShapes;
      const isCreatingGuide = saveMode === 'predefine';

      // Always replay the tools basics in the editor
      stepsQueue = [...TOOL_TUTORIALS, ...UI_TUTORIALS];

      // Append their specific current context
      if (isGuidedCritique) {
        stepsQueue = [...stepsQueue, ...GUIDED_TUTORIALS];
      } else if (isCreatingGuide) {
        stepsQueue = [...stepsQueue, ...GUIDE_CREATION_TUTORIALS];
      } else if (isNormalCritique) {
        stepsQueue = [...stepsQueue, ...NORMAL_CRITIQUE_TUTORIALS];
      }
    }

    // Fire up the overlay!
    if (stepsQueue.length > 0) {
      setActiveTutorialSteps(stepsQueue);
    }
  };

  const handleExitClick = () => {
    if (isPreviewMode) {
      setIsPreviewMode(false);
      setPresentationIndex(-1);
      setShowCriticAnswer(false);
      if (cameraActionsRef.current.resetCamera) cameraActionsRef.current.resetCamera();
    } else if (appMode === 'editor' && historyStepRef.current > 0) {
      setShowExitWarning(true);
    } else {
      onExit();
    }
  };

  useEffect(() => {
    if (activeTool === 'select' && selectedId) {
      const shape = shapes.find((s) => s.id === selectedId);
      if (shape) {
        if (shape.color) setBrushColor(shape.color);
        if (shape.strokeOpacity !== undefined) setStrokeOpacity(shape.strokeOpacity);
        if (shape.thickness) setBrushSize(shape.thickness);
        if (shape.fill) {
          setFillEnabled(true);
          setFillColor(shape.fill);
        } else {
          setFillEnabled(false);
        }
        if (shape.fillOpacity !== undefined) setFillOpacity(shape.fillOpacity);
      }
    }
  }, [selectedId, activeTool, shapes]);

  useEffect(() => {
    if (selectedId && isSidebarOpen) {
      const el = document.getElementById(`list-item-${selectedId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId, isSidebarOpen]);

  const updateSelectedShapeText = (key, value) => {
    const targetId = activeCommentId || selectedId;
    if (targetId) {
      setShapes((prevShapes) => prevShapes.map((shape) => {
        if (shape.id === targetId) {
          const updatedShape = { ...shape, [key]: value };
          if (shape.type === 'freehand' && shape.lines && (key === 'color' || key === 'thickness' || key === 'strokeOpacity')) {
            updatedShape.lines = shape.lines.map(l => ({ ...l, [key]: value }));
          }
          return updatedShape;
        }
        return shape;
      }));
    }
  };

  const closeCommentBoxAndCommit = () => {
    setActiveCommentId(null);
    updateAndCommit(p => p);
  };


  const handleUndo = useCallback(() => {
    if (historyStepRef.current <= 0 || effectiveAppMode === 'viewer') return;
    historyStepRef.current -= 1;
    setShapes(historyRef.current[historyStepRef.current]);
    setCanUndo(historyStepRef.current > 0);
    setCanRedo(true);
    setSelectedId(null);
    setActiveCommentId(null);
  }, [effectiveAppMode]);

  const handleRedo = useCallback(() => {
    if (historyStepRef.current >= historyRef.current.length - 1 || effectiveAppMode === 'viewer') return;
    historyStepRef.current += 1;
    setShapes(historyRef.current[historyStepRef.current]);
    setCanUndo(true);
    setCanRedo(historyStepRef.current < historyRef.current.length - 1);
    setSelectedId(null);
    setActiveCommentId(null);
  }, [effectiveAppMode]);

  // 👉 THE FIX: Listen for the hardware back button and trigger your smart exit logic!
  useEffect(() => {
    const handleHardwareBack = () => {
      // Prevent it from firing if they are currently exporting data
      if (exportPhase) return; 
      
      // 👉 THE FIX: Fire your existing smart exit function!
      // This will close preview mode, show the warning if there are unsaved changes, 
      // or exit cleanly if they haven't drawn anything yet!
      handleExitClick(); 
    };

    window.addEventListener('hardware_back_pressed', handleHardwareBack);
    return () => window.removeEventListener('hardware_back_pressed', handleHardwareBack);
  }, [exportPhase, isPreviewMode, appMode, onExit]); // 👉 Added dependencies so the function always has fresh state

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (effectiveAppMode === 'viewer') return;
      const isTyping = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
      
      // 👉 NEW: Escape Key universally kills the clipboard and closes UI
      if (e.key === 'Escape') {
        setClipboard(null);
        setPasteMenuPos(null);
        setSelectedId(null);
        setActiveCommentId(null);
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        e.preventDefault();
        deleteSelectedShape();
      }
      
      if (e.ctrlKey || e.metaKey) {
        if ((e.key === 'z' || e.key === 'Z') && !isTyping) {
          e.preventDefault();
          handleUndo();
        } else if ((e.key === 'y' || e.key === 'Y') && !isTyping) {
          e.preventDefault();
          handleRedo();
        } else if ((e.key === 'c' || e.key === 'C') && !isTyping) {
          e.preventDefault();
          handleCopy();
        } else if ((e.key === 'v' || e.key === 'V') && !isTyping) {
          e.preventDefault();
          handlePaste();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCopy, handlePaste, deleteSelectedShape, effectiveAppMode]);

  const renderShapeTree = (parentId = null, depth = 0) => {
    const children = validTreeShapes.filter(s => s.parentId === parentId);
    if (children.length === 0) return null;

    const textOutline = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 2px rgba(0,0,0,0.8)';

    return children.map((shape) => (
      <React.Fragment key={shape.id}>
        <button
          id={`list-item-${shape.id}`}
          onClick={() => {
            const targetIdx = validTreeShapes.findIndex(s => s.id === shape.id);
            if (effectiveAppMode === 'viewer') {
              setPresentationIndex(targetIdx);
              setShowCriticAnswer(false);
            }
            focusOnShape(shape.id, effectiveAppMode === 'viewer');
            setSelectedId(shape.id);
            setActiveCommentId(shape.id);
            if (effectiveAppMode !== 'viewer') setActiveTool('select');
          }}
          className={`p-3 border-b border-zinc-800 text-left hover:bg-white/10 transition ${
            selectedId === shape.id
              ? 'bg-blue-900/40 border-l-4 border-l-blue-500'
              : 'border-l-4 border-l-transparent'
          } ${depth > 0 ? 'bg-black/20' : ''}`}
          style={{
            paddingLeft: `${16 + depth * 16}px`,
            minWidth: '100%',
            width: 'max-content',
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 whitespace-nowrap pr-4">
              {depth > 0 && <span className="text-zinc-400 font-bold shrink-0" style={{ textShadow: textOutline }}>↳</span>}
              <span className={`text-[10px] font-bold w-5 h-5 flex shrink-0 items-center justify-center rounded-full shadow-lg ${
                selectedId === shape.id ? 'bg-blue-500 text-white' : 'bg-black/60 border border-zinc-600 text-zinc-200'
              }`}>
                {validTreeShapes.findIndex(s => s.id === shape.id) + 1}
              </span>
              <span className={`text-sm font-bold ${selectedId === shape.id ? 'text-blue-300' : 'text-white'} whitespace-nowrap`} style={{ textShadow: textOutline }}>
                {shape.title || 'Unnamed Object'}
              </span>
            </div>

            {shape.artistComment && (
              <span className={`text-[10px] mt-1 ${depth > 0 ? 'ml-11' : 'ml-7'} text-purple-300 italic font-bold whitespace-nowrap pr-4`} style={{ textShadow: textOutline }}>
                Artist: {shape.artistComment}
              </span>
            )}

            {shape.comment && (
              <span className={`text-xs mt-0.5 ${depth > 0 ? 'ml-11' : 'ml-7'} text-zinc-200 whitespace-nowrap pr-4`} style={{ textShadow: textOutline }}>
                {shape.comment}
              </span>
            )}
          </div>
        </button>
        {renderShapeTree(shape.id, depth + 1)}
      </React.Fragment>
    ));
  };

  const getExportStepStatus = (stepId) => {
    const isFullUpload = saveMode === 'predefine' && meta.originalFile;
    const phases = isFullUpload 
      ? ['compressing', 'uploading_temp', 'syncing_cloud', 'preparing', 'uploading', 'saving']
      : ['preparing', 'uploading', 'saving'];
    
    const currentIndex = phases.indexOf(exportPhase);
    const stepIndex = phases.indexOf(stepId);
    
    if (currentIndex === stepIndex) return 'active';
    if (currentIndex > stepIndex) return 'done';
    return 'pending';
  };

  const renderExportStep = (phaseId, text) => {
    const status = getExportStepStatus(phaseId);
    return (
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
          {status === 'active' && <div className="absolute w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>}
          <div className={`w-2 h-2 rounded-full relative z-10 transition-colors duration-300 ${status === 'active' ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : status === 'done' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
        </div>
        <p className={`text-xs sm:text-sm font-mono transition-colors duration-300 ${status === 'active' ? 'text-white font-bold' : status === 'done' ? 'text-zinc-300' : 'text-zinc-600'}`}>
          {text}
        </p>
      </div>
    );
  };

  return (
    // 👉 THE ULTIMATE FIX: Block it at the absolute highest level of the DOM!
    <div 
      className="fixed inset-0 w-full h-full bg-zinc-900 overflow-hidden text-white relative"
      onContextMenu={(e) => e.preventDefault()}
    >
      
      {/* 👉 THE NEW VERIFICATION GATE: Completely hides the canvas until approved! */}
      {isCheckingAccess && (
        <div className="absolute inset-0 z-[9999999] bg-zinc-900 flex flex-col items-center justify-center">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-white font-black tracking-widest uppercase text-sm animate-pulse">
            Verifying Access...
          </h2>
          <p className="text-zinc-500 text-xs mt-2 font-medium">Checking critique limits</p>
        </div>
      )}

      {/* 👉 THE FIX: Added the missing Keyframes for the loaders! */}
      <style>{`
        @keyframes engineFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes engineSpin { to { transform: rotate(360deg); } }
        @keyframes enginePulse { 
          0% { opacity: 0.7; transform: scale(0.98); } 
          50% { opacity: 1; transform: scale(1.02); } 
          100% { opacity: 0.7; transform: scale(0.98); } 
        }
        @keyframes engineZoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 bg-zinc-800 touch-none"
        style={{
          cursor: activeTool === 'pan' || effectiveAppMode === 'viewer' ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair',
          pointerEvents: isTopBarLocked ? 'none' : 'auto'
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isImageLoading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'engineFadeIn 0.3s ease-out' }}>
              <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '16px' }}>
                <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(63, 63, 70, 0.5)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', inset: 0, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'engineSpin 1s linear infinite', filter: 'drop-shadow(0 0 15px rgba(59,130,246,0.6))' }}></div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', opacity: 0.8, animation: 'enginePulse 2s infinite' }}><ImageIcon size={32} color="#ffffff" /></div>
              </div>
              <h3 style={{ color: '#d4d4d8', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '14px', margin: 0, animation: 'enginePulse 2s infinite' }}>Loading Canvas...</h3>
            </div>
        )}

        
        {dimensions.width > 0 && (
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            rotation={stageRotation}
            {...cameraHandlers}

            listening={!isTopBarLocked}

            // 👉 ADD THIS TO BLOCK THE BROWSER MENU
            onContextMenu={(e) => {
              if (e.evt) e.evt.preventDefault();
            }}
            
            onMouseDown={(e) => {
              if (cameraHandlers.onMouseDown) cameraHandlers.onMouseDown(e);
              
              if (activeTool === 'eraser' && e.evt.button === 0) {
                isErasingRef.current = true;
                handleEraseEvent(e); // Erase instantly on desktop click!
              }
            }}
            onMouseMove={(e) => {
              if (cameraHandlers.onMouseMove) cameraHandlers.onMouseMove(e);
              
              if (activeTool === 'eraser' && isErasingRef.current) {
                handleEraseEvent(e);
              }
            }}
            onMouseUp={(e) => {
              if (cameraHandlers.onMouseUp) cameraHandlers.onMouseUp(e);
              
              if (activeTool === 'eraser') {
                isErasingRef.current = false;
                setEraserTrail([]);
                updateAndCommit(p => p); 
              }
            }}
            onTouchStart={(e) => {
              if (cameraHandlers.onTouchStart) cameraHandlers.onTouchStart(e);
              
              if (activeTool === 'eraser') {
                if (e.evt.touches && e.evt.touches.length === 1) {
                  isErasingRef.current = true;
                } else {
                  // 👉 THE FIX: Second finger just landed! 
                  // Abort the eraser and instantly restore any shape Finger 1 accidentally deleted!
                  isErasingRef.current = false;
                  setEraserTrail([]);
                  setShapes([...historyRef.current[historyStepRef.current]]);
                }
              }
            }}
            onTouchMove={(e) => {
              if (cameraHandlers.onTouchMove) cameraHandlers.onTouchMove(e);
              
              if (activeTool === 'eraser' && isErasingRef.current) {
                if (e.evt.touches && e.evt.touches.length > 1) {
                  // 👉 THE FIX: Catch it here too, just in case the browser batches the events!
                  isErasingRef.current = false;
                  setEraserTrail([]);
                  setShapes([...historyRef.current[historyStepRef.current]]);
                } else {
                  handleEraseEvent(e);
                }
              }
            }}
            onMouseLeave={(e) => {
              if (cameraHandlers.onMouseLeave) cameraHandlers.onMouseLeave(e);
              
              if (activeTool === 'eraser') {
                isErasingRef.current = false;
                setEraserTrail([]);
                updateAndCommit(p => p);
              }
            }}
            onClick={(e) => { 
              if (activeTool !== 'eraser' && cameraHandlers.onClick) cameraHandlers.onClick(e); 
              if (activeTool === 'eraser') handleEraseEvent(e); // Catch desktop taps
            }}
            onTap={(e) => { 
              if (activeTool !== 'eraser' && cameraHandlers.onTap) cameraHandlers.onTap(e); 
              if (activeTool === 'eraser') {
                handleEraseEvent(e); // 👉 Catch mobile taps perfectly!
                setEraserTrail([]);
                updateAndCommit(p => p); // Save immediately
              }
            }}
          >
            <Layer>
              {imageObj && (
                <KonvaImage 
                  image={imageObj} 
                  x={0} 
                  y={0} 
                  draggable={false}
                  onContextMenu={(e) => e.evt.preventDefault()}
                />
              )}
            </Layer>

            <Layer ref={drawingLayerRef}>
              {visibleRenderedShapes.map((shape) => {
                let opacityOverride = 1;
                if (effectiveAppMode === 'viewer' && presentationIndex >= 0) {
                  if (shape.type === 'eraser') {
                    opacityOverride = 1;
                  } else {
                    const seqIndex = validTreeShapes.findIndex(s => s.id === shape.id);
                    if (seqIndex < presentationIndex) opacityOverride = 0.25;
                  }
                }
                return (
                  <MemoizedShape
                    key={shape.id}
                    shape={shape}
                    isSelected={shape.id === selectedId}
                    activeTool={activeTool}
                    onDragEnd={canvasEvents.handleShapeDragEnd}
                    onTransformEnd={canvasEvents.handleTransformEnd}
                    isViewer={effectiveAppMode === 'viewer'}
                    opacityOverride={opacityOverride}
                  />
                );
              })}

              {visibleRenderedShapes.map((shape) => {
                let opacityOverride = 1;
                if (effectiveAppMode === 'viewer' && presentationIndex >= 0) {
                  const seqIndex = validTreeShapes.findIndex(s => s.id === shape.id);
                  if (seqIndex < presentationIndex) opacityOverride = 0.25;
                }
                return (
                  <MemoizedLabel
                    key={`label-${shape.id}`}
                    shape={shape}
                    stageScale={stageScale}
                    opacityOverride={opacityOverride}
                  />
                );
              })}

              {((effectiveAppMode === 'editor' && (selectedId || activeCommentId)) || (effectiveAppMode === 'viewer' && presentationIndex >= 0)) && (() => {
                let targetId = activeCommentId || selectedId;
                if (effectiveAppMode === 'viewer') targetId = validTreeShapes[presentationIndex]?.id;

                const shape = shapes.find(s => s.id === targetId);
                if (!shape || shape.type === 'eraser') return null;
                const index = validTreeShapes.findIndex(s => s.id === targetId);

                return <MemoizedBadge key={`badge-${shape.id}`} shape={shape} index={index} isSelected={true} stageScale={stageScale} />;
              })()}

              {/* 👉 NEW: The Eraser Trail */}
              {activeTool === 'eraser' && eraserTrail.length > 2 && (
                <Line
                  points={eraserTrail}
                  stroke="#ec4899" 
                  strokeWidth={(brushSize * 2) / stageScale} 
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.6}
                  listening={false}
                />
              )}

              {activeTool === 'select' && selectedId && effectiveAppMode === 'editor' && shapes.find(s => s.id === selectedId && (s.type === 'line' || s.type === 'arrow')) && (
                shapes.find(s => s.id === selectedId).points.reduce((vertices, coord, idx, arr) => {
                  if (idx % 2 === 0) {
                    vertices.push(
                      <Circle
                        key={`vertex-${selectedId}-${idx}`}
                        x={coord}
                        y={arr[idx + 1]}
                        radius={6 / stageScale}
                        fill="#ffffff"
                        stroke="#3b82f6"
                        strokeWidth={2 / stageScale}
                        draggable
                        onDragStart={(e) => { if (e.evt && e.evt.touches && e.evt.touches.length > 1) e.target.stopDrag(); }}
                        onDragMove={(e) => canvasEvents.handleVertexDrag(e, selectedId, idx)}
                        onDragEnd={(e) => { e.cancelBubble = true; updateAndCommit(p => p); }}
                        perfectDrawEnabled={false}
                      />
                    );
                  }
                  return vertices;
                }, [])
              )}
              {activeTool === 'select' && selectedId && effectiveAppMode === 'editor' && !exportPhase && (
                <Transformer ref={trRef} flipEnabled={false} boundBoxFunc={(oldBox, newBox) => { if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox; return newBox; }} />
              )}
            </Layer>
          </Stage>
        )}
      </div>

      {/* Top Bar */}
        <div style={{ position: 'fixed', top: '16px', left: '16px', right: '16px', zIndex: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'auto' }}>
            <button
              onClick={handleExitClick}
              style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', padding: '8px 12px', color: '#ffffff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
            >
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span>
            </button>

            {!isSidebarOpen && (
              <button 
                id="tutorial-btn-list"
                onClick={() => setIsSidebarOpen(true)} 
                style={{ 
                  backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', padding: '8px 12px', color: '#ffffff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                  // 👉 THE NEW BLUE GLOW
                  boxShadow: highlightedDomId === 'tutorial-btn-list' ? '0 0 0 4px rgba(59, 130, 246, 0.8)' : '0 4px 10px rgba(0,0,0,0.5)' 
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
              >
                <List size={16} /> <span className="hidden sm:inline">List</span>
              </button>
            )}
            

            <h1 style={{ margin: '0 0 0 8px', fontSize: '18px', fontWeight: 900, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} className="hidden sm:block">
              {appMode === 'viewer' ? 'Presentation Mode' : isPreviewMode ? 'Preview Mode' : 'Critique Engine'}
            </h1>
          </div>

          {/* Normal Editor Tools */}
          {appMode === 'editor' && !isPreviewMode && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                // 👉 THE FIX: Uses the delayed state so ghost clicks hit a brick wall!
                pointerEvents: isTopBarLocked ? 'none' : 'auto',
                opacity: isTopBarLocked ? 0.3 : 1,
                transition: 'opacity 0.2s ease-in-out'
              }}
            >

              <div style={{ width: '1px', height: '24px', backgroundColor: '#3f3f46', margin: '0 4px' }} className="hidden sm:block"></div>
              <button 
                id="tutorial-btn-share"
                onClick={handleExportClick} 
                disabled={exportPhase !== null} 
                style={{ 
                  backgroundColor: '#2563eb', border: 'none', color: '#ffffff', borderRadius: '8px', padding: '8px 16px', fontWeight: 'bold', fontSize: '13px', cursor: exportPhase ? 'not-allowed' : 'pointer', opacity: exportPhase ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
                  // 👉 THE NEW GREEN GLOW
                  boxShadow: highlightedDomId === 'tutorial-btn-share' ? '0 0 0 4px rgba(34, 197, 94, 0.8)' : '0 4px 10px rgba(37,99,235,0.3)' 
                }}
                onMouseOver={(e) => { if(!exportPhase) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                onMouseOut={(e) => { if(!exportPhase) e.currentTarget.style.backgroundColor = '#2563eb'; }}
              >
                <Share2 size={16} /> <span className="hidden sm:inline">Share Data</span>
              </button>

              {/* 👉 NEW: Three Dots "More Options" Menu */}
              <div style={{ position: 'relative' }}>
                {/* Invisible overlay to close dropdown when clicking outside */}
                {isMoreMenuOpen && (
                  <div 
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setIsMoreMenuOpen(false); }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMoreMenuOpen(false); }}
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  />
                )}
                
                <button 
                  onClick={() => setIsMoreMenuOpen(prev => !prev)}
                  style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.2s', position: 'relative', zIndex: 100 }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                >
                  <MoreHorizontal size={20} color="#ffffff" />
                </button>

                {/* The Dropdown Panel */}
                {isMoreMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', padding: '8px', minWidth: '180px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', zIndex: 100 }}>
                    <button 
                      onClick={() => { setIsControlsOpen(true); setIsMoreMenuOpen(false); }} 
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', backgroundColor: 'transparent', color: '#d4d4d8', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} 
                      onMouseOver={e => { e.currentTarget.style.backgroundColor = '#27272a'; e.currentTarget.style.color = '#ffffff'; }} 
                      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#d4d4d8'; }}
                    >
                      <Keyboard size={16} /> Controls
                    </button>

                    {/* 👉 NEW: Replay Tutorial Button */}
                    <button 
                      onClick={handleRestartTutorial} 
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', backgroundColor: 'transparent', color: '#d4d4d8', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }} 
                      onMouseOver={e => { e.currentTarget.style.backgroundColor = '#27272a'; e.currentTarget.style.color = '#ffffff'; }} 
                      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#d4d4d8'; }}
                    >
                      <GraduationCap size={16} /> Replay Tutorial
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Preview Mode Tools */}
          {isPreviewMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
              <button 
                onClick={() => { setIsPreviewMode(false); setPresentationIndex(-1); setShowCriticAnswer(false); if(cameraActionsRef.current.resetCamera) cameraActionsRef.current.resetCamera(); }} 
                style={{ backgroundColor: '#3f3f46', border: 'none', color: '#ffffff', borderRadius: '8px', padding: '8px 16px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', transition: 'background-color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#52525b'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              >
                Edit
              </button>
              <button
                onClick={() => { setIsPreviewMode(false); executeExport(); }} 
                disabled={exportPhase !== null} 
                style={{ backgroundColor: '#16a34a', border: 'none', color: '#ffffff', borderRadius: '8px', padding: '8px 16px', fontWeight: 'bold', fontSize: '13px', cursor: exportPhase ? 'not-allowed' : 'pointer', opacity: exportPhase ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)', transition: 'background-color 0.2s' }}
                onMouseOver={(e) => { if(!exportPhase) e.currentTarget.style.backgroundColor = '#15803d'; }}
                onMouseOut={(e) => { if(!exportPhase) e.currentTarget.style.backgroundColor = '#16a34a'; }}
              >
                🚀 Publish
              </button>
            </div>
          )}
        </div>

      {/* 👉 THE FIX: Invisible hit-shield for the Left Sidebar */}
        {isSidebarOpen && (
          <div 
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setIsSidebarOpen(false); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsSidebarOpen(false); }}
            style={{ 
              position: 'fixed', inset: 0, zIndex: 9998, // Sits exactly 1 layer behind the 9999 Sidebar!
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'none' // Prevents scrolling the canvas accidentally
            }}
          />
        )}

      {/* Sidebar */}
        <div
          // 1. Purely block the browser menu (this fires on mouse UP)
          onContextMenu={(e) => e.preventDefault()} 
          
          // 2. Catch the right-click perfectly (this fires on mouse DOWN, matching the canvas)
          onPointerDown={(e) => {
            if (e.button === 2) { // Button 2 is Right-Click!
              e.preventDefault();
              e.stopPropagation(); // 👈 Crucial: Stops the canvas from seeing this click!
              setIsSidebarOpen(false);
            }
          }}

          style={{
            position: 'fixed', top: 0, bottom: 0, left: 0, width: '75%', maxWidth: '320px', backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRight: '1px solid #27272a', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', zIndex: 9999, transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '10px 0 30px rgba(0,0,0,0.8)',
            transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-120%)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #27272a', backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#60a5fa', margin: 0, textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}>
              Object Hierarchy
            </h2>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setIsSidebarOpen(false); }}
              onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(false); }}
              style={{ backgroundColor: 'rgba(39, 39, 42, 0.8)', border: '1px solid #52525b', color: '#e4e4e7', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.8)'}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: 'max-content', paddingBottom: '24px' }}>
              {validTreeShapes.length === 0 ? (
                <p style={{ padding: '16px', fontSize: '12px', color: '#a1a1aa', fontStyle: 'italic', fontWeight: 'bold', margin: 0, textShadow: '1px 1px 2px #000' }}>No objects found.</p>
              ) : (
                renderShapeTree(null, 0)
              )}
            </div>

          </div>
        </div>

        {/* 👉 THE FIX: Invisible hit-shield for the Right Sidebar */}
        {isControlsOpen && (
          <div 
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setIsControlsOpen(false); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsControlsOpen(false); }}
            style={{ 
              position: 'fixed', inset: 0, zIndex: 9998, 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'none'
            }}
          />
        )}

        {/* 👉 NEW: Controls Sidebar (Right Side) */}
        <div
          onContextMenu={(e) => e.preventDefault()} 
          onPointerDown={(e) => {
            if (e.button === 2) {
              e.preventDefault();
              e.stopPropagation();
              setIsControlsOpen(false); // Closes on right click!
            }
          }}
          style={{
            position: 'fixed', top: 0, bottom: 0, right: 0, width: '75%', maxWidth: '320px', backgroundColor: 'rgba(0, 0, 0, 0.5)', borderLeft: '1px solid #27272a', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', zIndex: 9999, transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '-10px 0 30px rgba(0,0,0,0.8)',
            transform: isControlsOpen ? 'translateX(0)' : 'translateX(120%)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #27272a', backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#60a5fa', margin: 0, textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}>
              ⌨️ Controls
            </h2>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setIsControlsOpen(false); }}
              onClick={(e) => { e.stopPropagation(); setIsControlsOpen(false); }}
              style={{ backgroundColor: 'rgba(39, 39, 42, 0.8)', border: '1px solid #52525b', color: '#e4e4e7', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.8)'}
            >
              ✕ Close
            </button>
          </div>

          {/* List of Shortcuts */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* 👉 THE UPDATED TOGGLE SWITCH */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px', backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid #3f3f46', borderRadius: '8px', marginBottom: '4px' }}>
              <div style={{ flex: 1, paddingRight: '12px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Mouse Wheel Rotation</h3>
                <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '4px 0 0 0', lineHeight: 1.3 }}>Allow rotating the canvas using Wheel Press + Scroll. (Space/R + Scroll are always active).</p>
              </div>
              <button
                onClick={() => toggleAndSavePreference('pref_wheel_rotation', isRotationEnabled, setIsRotationEnabled)}
                style={{
                  width: '44px', height: '24px', borderRadius: '12px',
                  backgroundColor: isRotationEnabled ? '#3b82f6' : '#3f3f46',
                  border: 'none', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0,
                  boxShadow: isRotationEnabled ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none'
                }}
              >
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff',
                  position: 'absolute', top: '3px', left: isRotationEnabled ? '23px' : '3px',
                  transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                }} />
              </button>
            </div>

            {/* Helper function to keep code clean */}
            {[
              { icon: <GraduationCap size={18} color="#60a5fa" />, title: "Tool Tutorial", shortcut: "Right-Click / Hold on Tools" },
              { icon: <Search size={18} color="#a1a1aa" />, title: "Zoom In / Out", shortcut: "Wheel Scroll" },
              { icon: <Hand size={18} color="#a1a1aa" />, title: "Pan Canvas", shortcut: "Wheel Press + Drag" },
              { icon: <RotateCw size={18} color="#a1a1aa" />, title: "Rotate Canvas", shortcut: "Space / R + Scroll" },
              { icon: <List size={18} color="#a1a1aa" />, title: "Open / Close List", shortcut: "Right Click" },
              { icon: <Undo2 size={18} color="#a1a1aa" />, title: "Undo / Redo", shortcut: "Ctrl + Z / Y" },
              { icon: <Trash2 size={18} color="#ef4444" />, title: "Delete Object", shortcut: "Select + Delete" },
              { icon: <CheckCircle size={18} color="#4ade80" />, title: "Finish Poly", shortcut: "Double Click" }
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid #3f3f46', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* 👉 THE FIX: Using Flex to perfectly center the SVG */}
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>
                    {item.icon}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d4d4d8' }}>{item.title}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '900', color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)', textAlign: 'center' }}>
                  {item.shortcut}
                </span>
              </div>
            ))}

          </div>

          {/* 👉 THE NEW TOUCH ROTATION TOGGLE SWITCH */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px', backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid #3f3f46', borderRadius: '8px', marginBottom: '4px' }}>
            <div style={{ flex: 1, paddingRight: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Touch Rotation</h3>
              <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '4px 0 0 0', lineHeight: 1.3 }}>Allow rotating the canvas using a two-finger twist on touch screens.</p>
            </div>
            <button
              onClick={() => toggleAndSavePreference('pref_touch_rotation', isTouchRotationEnabled, setIsTouchRotationEnabled)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px',
                backgroundColor: isTouchRotationEnabled ? '#3b82f6' : '#3f3f46',
                border: 'none', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0,
                boxShadow: isTouchRotationEnabled ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff',
                position: 'absolute', top: '3px', left: isTouchRotationEnabled ? '23px' : '3px',
                transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
              }} />
            </button>
          </div>

        </div>
        

      {effectiveAppMode === 'editor' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-stretch gap-2 max-w-[95vw] pointer-events-none">
          

          {/* 👉 Properties Lambda (Λ) & Mobile Undo/Redo Tabs */}
          <div style={{ position: 'relative', width: '100%', pointerEvents: 'none' }}>
            
            {/* Left Side: Lambda Button */}
            <div style={{ position: 'absolute', bottom: '0px', left: '16px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {!showProperties ? (
                <button
                  onClick={() => setShowProperties(true)}
                  style={{
                    backgroundColor: '#27272a',
                    border: '1px solid #52525b',
                    borderBottom: 'none',
                    borderRadius: '8px 8px 0 0',
                    padding: '4px 16px',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(2px)' 
                  }}
                  title="Open Properties"
                >
                  Λ
                </button>
              ) : (
                <div style={{
                  backgroundColor: 'rgba(24, 24, 27, 0.95)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid #52525b',
                  borderRadius: '16px',
                  borderBottomLeftRadius: '0px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  width: '260px',
                  boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.3)',
                  marginBottom: '2px'
                }}>
                  <button
                    onClick={() => setShowProperties(false)}
                    style={{ alignSelf: 'flex-start', backgroundColor: '#3f3f46', border: '1px solid #52525b', borderRadius: '6px', padding: '2px 10px', color: 'white', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer' }}
                    title="Close Properties"
                  >
                    V
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa', minWidth: '50px', textAlign: 'right' }}>opacity:</span>
                      <input type="range" min="0.1" max="1" step="0.1" value={strokeOpacity} onChange={(e) => { setStrokeOpacity(parseFloat(e.target.value)); updateSelectedShapeText('strokeOpacity', parseFloat(e.target.value)); }} style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6', margin: 0 }} />
                      <input type="color" value={brushColor} onChange={(e) => { setBrushColor(e.target.value); updateSelectedShapeText('color', e.target.value); }} style={{ width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer', background: 'transparent', border: '1px solid #52525b', padding: 0 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa', minWidth: '50px', textAlign: 'right' }}>fill:</span>
                      <input type="range" min="0.1" max="1" step="0.1" value={fillOpacity} onChange={(e) => { setFillOpacity(parseFloat(e.target.value)); updateSelectedShapeText('fillOpacity', parseFloat(e.target.value)); }} disabled={!fillEnabled} style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6', margin: 0, opacity: fillEnabled ? 1 : 0.3 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input type="checkbox" checked={fillEnabled} onChange={(e) => { setFillEnabled(e.target.checked); updateSelectedShapeText('fill', e.target.checked ? fillColor : null); }} style={{ width: '14px', height: '14px', accentColor: '#3b82f6', cursor: 'pointer', margin: 0 }} />
                        <input type="color" value={fillColor} onChange={(e) => { setFillColor(e.target.value); updateSelectedShapeText('fill', e.target.value); }} disabled={!fillEnabled} style={{ width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer', background: 'transparent', border: '1px solid #52525b', padding: 0, opacity: fillEnabled ? 1 : 0.3 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a1a1aa', minWidth: '50px', textAlign: 'right' }}>size:</span>
                      <input type="range" min="1" max="30" value={brushSize} onChange={(e) => { setBrushSize(parseInt(e.target.value)); updateSelectedShapeText('thickness', parseInt(e.target.value)); }} style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6', margin: 0 }} />
                      <span style={{ width: '40px' }}></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Action Tabs */}
            <div style={{ position: 'absolute', bottom: '0px', right: '16px', pointerEvents: 'auto', display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
              
              {/* 👉 NEW: Cancel Paste Button (Subtle & Normal) */}
              {clipboard && (
                <button
                  onPointerDown={(e) => { 
                    e.preventDefault(); 
                    setClipboard(null); 
                    setPasteMenuPos(null); 
                  }}
                  style={{
                    backgroundColor: '#27272a',
                    border: '1px solid #52525b',
                    borderBottom: 'none',
                    borderRadius: '8px 8px 0 0',
                    padding: '4px 12px',
                    color: '#d4d4d8',
                    cursor: 'pointer',
                    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(2px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.backgroundColor = '#3f3f46'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#d4d4d8'; e.currentTarget.style.backgroundColor = '#27272a'; }}
                  title="Cancel Paste"
                >
                  <X size={14} />
                  <span style={{ fontSize: '12px', fontWeight: '500' }}>Cancel Copy</span>
                </button>
              )}

              <button
                className="sm:hidden" // 👈 Kept hidden on desktop
                onPointerDown={(e) => { e.preventDefault(); if (canUndo) handleUndo(); }}
                disabled={!canUndo}
                style={{
                  backgroundColor: '#27272a',
                  border: '1px solid #52525b',
                  borderBottom: 'none',
                  borderRadius: '8px 8px 0 0',
                  padding: '4px 12px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: canUndo ? 'pointer' : 'not-allowed',
                  boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(2px)',
                  opacity: canUndo ? 1 : 0.5
                }}
                title="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                className="sm:hidden" // 👈 Kept hidden on desktop
                onPointerDown={(e) => { e.preventDefault(); if (canRedo) handleRedo(); }}
                disabled={!canRedo}
                style={{
                  backgroundColor: '#27272a',
                  border: '1px solid #52525b',
                  borderBottom: 'none',
                  borderRadius: '8px 8px 0 0',
                  padding: '4px 12px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: canRedo ? 'pointer' : 'not-allowed',
                  boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(2px)',
                  opacity: canRedo ? 1 : 0.5
                }}
                title="Redo"
              >
                <Redo2 size={16} />
              </button>
            </div>

          </div>

          {activeTool === 'freehand' && (
            <div 
              id="tutorial-freehand-msg" // 👉 ADDED ID
              className="pointer-events-auto w-full flex flex-row items-stretch gap-2 bg-black/80 backdrop-blur-md border-2 border-zinc-600 rounded-2xl p-1.5 animate-in fade-in slide-in-from-bottom-2"
              style={{
                // 👉 ADDED DYNAMIC BLUE GLOW
                boxShadow: highlightedDomId === 'tutorial-freehand-msg' ? '0 0 0 4px #3b82f6' : '0 10px 40px rgba(0,0,0,0.8)',
                transition: 'box-shadow 0.3s ease'
              }}
            >
              <div style={{ flex: canvasEvents.hasActiveFreehand ? 2 : 1, paddingLeft: '24px' }} className="min-w-0 flex flex-col justify-center pr-2 py-2 sm:py-3 overflow-hidden transition-all duration-300">
                <span className="text-xs sm:text-sm md:text-base font-mono font-bold text-zinc-200 tracking-tight leading-tight truncate uppercase">
                  {canvasEvents.hasActiveFreehand ? "Pencil Mode: finished Drawing?" : "Pencil Mode"}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-mono font-bold text-zinc-400 tracking-tight leading-tight truncate mt-0.5 sm:mt-1">
                  {canvasEvents.hasActiveFreehand ? "Comment on your pencil strokes" : "Start drawing anywhere on the canvas..."}
                </span>
              </div>

              {canvasEvents.hasActiveFreehand && (
                <button
                  style={{ flex: 1 }}
                  onClick={canvasEvents.commitFreehand}
                  className="self-stretch w-full m-0 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-2 border-zinc-500 rounded-xl text-white font-mono font-bold text-sm sm:text-base md:text-lg transition-all shadow-inner cursor-pointer animate-in zoom-in duration-200"
                >
                  Comment
                </button>
              )}
            </div>
          )}

          <div 
            id="tutorial-toolbar" 
            className="relative pointer-events-auto flex gap-1 sm:gap-2 bg-black/80 p-2 rounded-xl overflow-x-auto"
            style={{
              boxShadow: highlightedDomId === 'tutorial-toolbar' ? '0 0 0 4px #3b82f6' : '0 25px 50px -12px rgba(0,0,0,0.5)', 
              transition: 'box-shadow 0.3s ease' 
            }}
          >
            {/* TEMP DEV BUTTON - REMOVE BEFORE PRODUCTION */}
            <button 
              onClick={resetTutorialMemory} 
              style={{  
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 'bold',
                border: 'none'
              }}
            >
            <Trash2 size={16} /> <span className="hidden sm:inline">Nuke</span>
            </button>

            <button 
              onClick={() => canvasEvents.changeTool('pan')} 
              onContextMenu={(e) => handleToolRightClick(e, 'pan')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'pan' ? 'bg-zinc-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><Hand size={16} /> <span className="hidden sm:inline">Pan</span>
            </button>

            <button 
              onClick={() => canvasEvents.changeTool('select')} 
              onContextMenu={(e) => handleToolRightClick(e, 'select')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'select' ? 'bg-zinc-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><MousePointer2 size={16} /> <span className="hidden sm:inline">Select</span>
            </button>

            <div className="w-px shrink-0 bg-zinc-700 mx-1"></div>
            
            <button 
              id="tutorial-tool-rect" 
              onClick={() => canvasEvents.changeTool('rect')} 
              onContextMenu={(e) => handleToolRightClick(e, 'rect')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'rect' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><Square size={16} /> <span className="hidden sm:inline">Frame</span>
            </button>

            <button 
              id="tutorial-tool-line" 
              onClick={() => canvasEvents.changeTool('line')} 
              onContextMenu={(e) => handleToolRightClick(e, 'line')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'line' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><Slash size={16} /> <span className="hidden sm:inline">Poly</span>
            </button>
            
            {/* 👉 ADDED IDs for Arrow, Lasso, and Eraser! */}
            <button 
              id="tutorial-tool-arrow" 
              onClick={() => canvasEvents.changeTool('arrow')} 
              onContextMenu={(e) => handleToolRightClick(e, 'arrow')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'arrow' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><ArrowUpRight size={16} /> <span className="hidden sm:inline">Arrow</span>
            </button>

            <button 
              id="tutorial-tool-lasso" 
              onClick={() => canvasEvents.changeTool('lasso')} 
              onContextMenu={(e) => handleToolRightClick(e, 'lasso')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'lasso' ? 'bg-blue-600 text-white shadow-inner' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><Lasso size={16} /> <span className="hidden sm:inline">Lasso</span>
            </button>

            <button 
              id="tutorial-tool-freehand" 
              onClick={() => canvasEvents.changeTool('freehand')} 
              onContextMenu={(e) => handleToolRightClick(e, 'freehand')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'freehand' ? 'bg-blue-600 text-white shadow-inner' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><PenTool size={16} /> <span className="hidden sm:inline">Draw</span>
            </button>
            
            <div className="w-px shrink-0 bg-zinc-700 mx-1"></div>

            <button 
              id="tutorial-tool-eraser" 
              onClick={() => canvasEvents.changeTool('eraser')} 
              onContextMenu={(e) => handleToolRightClick(e, 'eraser')}
              className={`px-3 py-2 rounded text-sm font-bold transition-colors ${activeTool === 'eraser' ? 'bg-pink-500 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
            ><Eraser size={16} /> <span className="hidden sm:inline">Erase</span>
            </button>

          </div>
          {/* 👉 THE FIX: Pure inline CSS forcing it below the bottom edge! */}
          <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', textAlign: 'center', marginTop: '2px', pointerEvents: 'none', opacity: 0.2 }}>
            <span style={{ fontSize: '10px', color: '#ffffff', letterSpacing: '0.5px' }}>
              Right-click or hold a tool to see how it works
            </span>
          </div>
        </div>
      )}

      {effectiveAppMode === 'viewer' && validTreeShapes.length > 0 && (() => {
        const shape = presentationIndex >= 0 ? validTreeShapes[presentationIndex] : null;

        const hasBoth = shape && shape.artistComment && shape.comment;
        const isShowingArtist = shape && shape.artistComment && (!shape.comment || !showCriticAnswer);
        const isShowingCritic = shape && shape.comment && (!shape.artistComment || showCriticAnswer);

        return (
          <div style={{ position: 'fixed', bottom: '0', left: '0', width: '100%', zIndex: 90, pointerEvents: 'none' }}>
            <div
              onClick={cameraHandlers.onClick}
              onWheel={(e) => {
                const container = document.getElementById('subtitle-scroll-container');
                if (container && container.scrollHeight > container.clientHeight) e.stopPropagation();
                else {
                  e.preventDefault();
                  cameraHandlers.onWheel(e);
                }
              }}
              style={{
                pointerEvents: 'auto',
                backgroundColor: 'rgba(0, 0, 0, 0.2)', // Slightly darker for better readability when expanded
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.7)',
                // 👉 THE FIX: Dynamic height driven by the drag state!
                height: `${presentationPanelHeight}px`,
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                transition: isDraggingPanel.current ? 'none' : 'height 0.2s ease-out' // Smooth snap back, but instant when dragging
              }}
            >
              {/* 👉 THE FIX: 3px Layout with a 33px Hit Target! */}
              <div
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Stops the presentation from skipping
                  isDraggingPanel.current = true;
                }}
                onClick={(e) => e.stopPropagation()} 
                style={{
                  position: 'relative', // 👈 1. REQUIRED to anchor the invisible bumper
                  width: '100%', 
                  height: '3px',        // 👈 2. Keeps your UI layout perfectly tight!
                  cursor: 'ns-resize', 
                  flexShrink: 0,
                  touchAction: 'none', 
                  backgroundColor: 'transparent'
                }}
              >
                {/* 👉 THE INVISIBLE BUMPER */}
                {/* This catches the thumb and passes the click up to the parent! */}
                <div 
                  style={{
                    position: 'absolute',
                    top: '-15px',    // Bleeds 15px above the 3px line
                    bottom: '-15px', // Bleeds 15px below the 3px line
                    left: 0,
                    right: 0,
                    zIndex: 10       // Ensures it sits strictly on top of everything
                  }}
                />
              </div>

              {/* The glassy top border edge */}
              <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', flexShrink: 0 }}></div>

              <div id="subtitle-scroll-container" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', width: '100%' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {shape ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: 'clamp(1.1rem, 2.5vw, 2rem)', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '1px', textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 4px 8px rgba(0,0,0,0.8)' }}>
                            {shape.title || 'Unnamed Object'}
                          </h3>
                          {isShowingArtist && (
                            <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: 'rgba(168, 85, 247, 0.8)', color: 'white', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                              Artist Question
                            </span>
                          )}
                          {isShowingCritic && hasBoth && (
                            <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.8)', color: 'white', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                              Critic Answer
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 900, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 10px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)', flexShrink: 0 }}>
                          Step {presentationIndex + 1} / {validTreeShapes.length}
                        </span>
                      </div>

                      {isShowingArtist && (
                        <p style={{ margin: '4px 0 0 0', fontSize: 'clamp(0.9rem, 2vw, 1.25rem)', color: '#d8b4fe', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontWeight: 600, fontStyle: 'italic', textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)' }}>
                          "{shape.artistComment}"
                        </p>
                      )}

                      {isShowingCritic && (
                        <p style={{ margin: '4px 0 0 0', fontSize: 'clamp(0.9rem, 2vw, 1.25rem)', color: '#ffffff', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontWeight: 700, textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)' }}>
                          {shape.comment}
                        </p>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.1rem, 2.5vw, 2rem)', fontWeight: 'bold', color: 'white', textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}>Presentation Ready</h3>
                      <p style={{ margin: 0, fontSize: 'clamp(0.85rem, 1.5vw, 1rem)', color: '#d4d4d8', fontWeight: 500, textShadow: '1px 1px 0px #000' }}>
                        Click the left/right sides or scroll to begin.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {effectiveAppMode === 'editor' && !selectedId && pasteMenuPos && clipboard && (
        <div
          className="absolute z-40 pointer-events-auto"
          style={{ 
            left: getScreenCoordinate(pasteMenuPos.x, pasteMenuPos.y, stagePos, stageScale, stageRotation).x, 
            top: getScreenCoordinate(pasteMenuPos.x, pasteMenuPos.y, stagePos, stageScale, stageRotation).y - 40 
          }}
        >
          <button
            onClick={() => handlePaste(pasteMenuPos.x, pasteMenuPos.y)}
            className="w-12 h-12 bg-green-600 hover:bg-green-500 border-2 border-zinc-900 text-white rounded-full shadow-2xl flex items-center justify-center font-bold transition-transform hover:scale-110"
            title="Paste Object Here"
          >
            <Copy size={18} /> <span style={{ fontSize: '12px' }}>+</span>
          </button>
        </div>
      )}

      {/* 👉 1. Smart Clamping for Action Bar */}
      {effectiveAppMode === 'editor' && selectedId && (() => {
        const shape = shapes.find(s => s.id === selectedId);
        if (!shape || shape.type === 'eraser') return null;
        
        const bounds = getShapeBounds(shape);
        const topPos = getScreenCoordinate(bounds.x + bounds.w, bounds.y, stagePos, stageScale, stageRotation);
        const bottomPos = getScreenCoordinate(bounds.x + bounds.w, bounds.y + bounds.h, stagePos, stageScale, stageRotation);
        
        let finalX = topPos.x + 10;
        let finalY = topPos.y - 20;

        if (finalY < 80) {
           finalY = bottomPos.y + 20;
        }

        if (finalX + 90 > dimensions.width) finalX = dimensions.width - 90; 

        return (
          <div
            className="absolute z-40 flex gap-2 pointer-events-auto"
            style={{ left: finalX, top: finalY }}
          >
            <button
              onClick={handleCopy}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-500 border-2 border-zinc-900 text-white rounded-full shadow-2xl flex items-center justify-center font-bold transition-transform hover:scale-110"
              title="Copy Object"
            >
              <Copy size={18} /> <span style={{ fontSize: '12px' }}></span>
          </button>
            <button
              onClick={deleteSelectedShape}
              className="w-10 h-10 bg-red-600 hover:bg-red-500 border-2 border-zinc-900 text-white rounded-full shadow-2xl flex items-center justify-center font-bold transition-transform hover:scale-110"
              title="Delete Object"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })()}

      {/* 👉 2. Smart Clamping for Comment Box */}
      {effectiveAppMode === 'editor' && activeCommentShape && (() => {
        const bounds = getShapeBounds(activeCommentShape);
        const topPos = getScreenCoordinate(bounds.x, bounds.y, stagePos, stageScale, stageRotation);
        const bottomPos = getScreenCoordinate(bounds.x, bounds.y + bounds.h, stagePos, stageScale, stageRotation);

        const isMobile = window.innerWidth < 640;
        const boxWidth = isMobile ? 240 : 270;
        const boxHeight = isMobile ? 200 : 220;
        
        let finalX = topPos.x;
        let finalY = topPos.y - 15;
        let transformStyle = 'translateY(-100%)'; 

        if (finalY - boxHeight < 80) {
            finalY = bottomPos.y + 15; 
            transformStyle = 'translateY(0)';
            
            if (finalY + boxHeight > dimensions.height) {
                finalY = (dimensions.height / 2) - (boxHeight / 2);
                finalX = (dimensions.width / 2) - (boxWidth / 2);
                transformStyle = 'translateY(0)';
            }
        }

        if (finalX + boxWidth > dimensions.width) {
            finalX = dimensions.width - boxWidth - 20;
        }
        if (finalX < 20) {
            finalX = 20;
        }

        return (
          <div
            className="absolute z-40 pointer-events-auto shadow-2xl transition-all duration-75"
            style={{
              left: finalX,
              top: finalY,
              transform: transformStyle,
              width: boxWidth
            }}
          >
            <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 w-64 flex flex-col gap-2 relative">
              <button onClick={closeCommentBoxAndCommit} className="absolute top-2 right-2 text-zinc-400 hover:text-white font-bold z-30" title="Close">✕</button>
              <div className="flex flex-col gap-2 pt-1">
  
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider pr-10">
                  {saveMode === 'predefine' ? '🎯 Guide Setup' : `Object Details ${activeCommentShape.parentId ? '(Child)' : ''}`}
                </span>
  
                <input
                  type="text"
                  maxLength={40}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500 font-bold placeholder-zinc-500"
                  placeholder={saveMode === 'predefine' ? "Name this part (e.g. 'Lighting')" : "Title (e.g. 'Lady')"}
                  value={activeCommentShape.title || ''}
                  onChange={(e) => updateSelectedShapeText('title', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
  
                {saveMode !== 'predefine' && activeCommentShape.artistComment && (
                  <div className="bg-zinc-900/80 border border-purple-500/50 p-2 rounded-md mt-1">
                    <p className="text-[10px] font-bold text-purple-400 uppercase mb-0.5">Artist's Context</p>
                    <p className="text-xs text-zinc-300 italic">"{activeCommentShape.artistComment}"</p>
                  </div>
                )}
  
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500 placeholder-zinc-500 mt-1"
                  rows={3}
                  placeholder={saveMode === 'predefine' ? "Ask a question for this part..." : "Type your critique answer here..."}
                  value={saveMode === 'predefine' ? (activeCommentShape.artistComment || '') : (activeCommentShape.comment || '')}
                  onChange={(e) => updateSelectedShapeText(saveMode === 'predefine' ? 'artistComment' : 'comment', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
  
              </div>
            </div>
          </div>
        );
      })()}

      {/* 👉 CUSTOM UPLOAD WARNING MODAL */}
      {uploadWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl flex flex-col items-center gap-4 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-zinc-900 text-2xl font-bold shadow-[0_0_15px_rgba(234,179,8,0.5)]">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-xl font-bold text-white tracking-wide">Hold up!</h3>
            <p className="text-sm text-zinc-300 leading-relaxed font-medium">
              {uploadWarning}
            </p>
            <button 
              onClick={() => setUploadWarning(null)} 
              className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-colors shadow-lg cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* 👉 PREVIEW MODAL */}
      {showPreviewPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl flex flex-col items-center gap-4 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold"><Eye size={24} /></div>
            <h3 className="text-xl font-bold text-white">Preview Presentation?</h3>
            <p className="text-sm text-zinc-400">Test exactly how the artist will view your critique step-by-step before publishing.</p>
            <div className="flex gap-3 w-full mt-2">
              <button onClick={() => { setShowPreviewPrompt(false); executeExport(); }} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 rounded transition">Skip</button>
              <button onClick={() => { 
                setShowPreviewPrompt(false); 
                setIsPreviewMode(true); 
                setPresentationIndex(-1);
                setShowCriticAnswer(false);
                setSelectedId(null);
                setActiveCommentId(null);
                if (cameraActionsRef.current.resetCamera) cameraActionsRef.current.resetCamera();
              }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition">Preview</button>
            </div>
          </div>
        </div>
      )}

      {exportPhase && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '16px', animation: 'engineFadeIn 0.3s ease-out' }}>
            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.9)', border: '1px solid #27272a', padding: '32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', maxWidth: '384px', width: '100%', boxShadow: '0 0 50px rgba(0,0,0,0.8)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '160px', height: '160px', backgroundColor: 'rgba(37, 99, 235, 0.2)', borderRadius: '50%', filter: 'blur(40px)', animation: 'enginePulse 2s infinite' }}></div>
              <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '16px' }}>
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid #27272a', borderRadius: '50%' }}></div>
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'engineSpin 1s linear infinite', filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.6))' }}></div>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}><UploadIcon size={32} color="#ffffff" /></div>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', letterSpacing: '1px', margin: '0 0 4px 0' }}>Publishing...</h2>
                <p style={{ color: '#f87171', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', animation: 'enginePulse 2s infinite', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 12px', borderRadius: '999px', border: '1px solid rgba(239, 68, 68, 0.2)', margin: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                  Do not close this tab
                </p>
              </div>
              <div style={{ width: '100%', backgroundColor: 'rgba(9, 9, 11, 0.6)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(39, 39, 42, 0.5)', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
                {saveMode === 'predefine' && meta.originalFile && (
                  <>
                    {renderExportStep('compressing', 'Baking high-speed thumbnail')}
                    {renderExportStep('uploading_temp', 'Securing high-res original')}
                    {renderExportStep('syncing_cloud', 'Syncing with cloud network')}
                  </>
                )}
                {renderExportStep('preparing', 'Encoding layer data')}
                {renderExportStep('uploading', 'Uploading critique layer')}
                {renderExportStep('saving', 'Saving to gallery')}
              </div>
            </div>
          </div>
        )}

      {exportError && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl flex flex-col items-center gap-4 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">!</div>
            <h3 className="text-xl font-bold text-white">Upload Failed</h3>
            <p className="text-sm text-red-400">{exportError}</p>
            <button onClick={() => setExportError(null)} className="mt-2 w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 rounded transition">Dismiss</button>
          </div>
        </div>
      )}

      {showExitWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl flex flex-col items-center gap-4 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-zinc-900 text-2xl font-bold">!</div>
            <h3 className="text-xl font-bold text-white">Unsaved Changes</h3>
            <p className="text-sm text-zinc-400">Are you sure you want to leave? Your unsaved progress will be lost.</p>
            <div className="flex gap-3 w-full mt-2">
              <button onClick={() => setShowExitWarning(false)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 rounded transition">Cancel</button>
              <button onClick={onExit} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded transition">Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* 👉 ADD THIS NEW BLOCKER: Daily Limit Reached Modal */}
      {isLimitReached && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: '16px', animation: 'engineFadeIn 0.3s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 0 25px rgba(239, 68, 68, 0.2)' }}>
                <OctagonAlert size={32} color="#f87171" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#f87171', margin: 0, letterSpacing: '-0.5px' }}>Daily Limit Reached</h2>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                You have reached your limit of 10 critiques for today. Please come back tomorrow to share more feedback!
              </p>
            </div>
            <button 
              onClick={onExit} 
              style={{ width: '100%', padding: '14px', backgroundColor: '#27272a', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', marginTop: '8px' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* 👉 NEW BLOCKER: Already Critiqued Custom Modal */}
      {alreadyCritiqued && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: '16px', animation: 'engineFadeIn 0.3s ease-out' }}>
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', position: 'relative', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: '1px solid rgba(59, 130, 246, 0.2)', boxShadow: '0 0 25px rgba(59, 130, 246, 0.2)' }}>
                <CheckCircle size={32} color="#60a5fa" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#60a5fa', margin: 0, letterSpacing: '-0.5px' }}>Already Critiqued</h2>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: '1.5' }}>
                You have already shared your feedback on this artwork! Only one critique per artwork is allowed.
              </p>
            </div>
            <button 
              onClick={onExit} 
              style={{ width: '100%', padding: '14px', backgroundColor: '#27272a', color: '#ffffff', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', marginTop: '8px' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* 👉 RENDER THE TUTORIAL OVERLAY */}
      {activeTutorialSteps.length > 0 && (
        <TutorialOverlay 
          steps={activeTutorialSteps} 
          onComplete={handleTutorialComplete} 
          getShapeScreenPos={getShapeScreenPos} 
          onStepChange={handleTutorialStepChange} // 👉 THE MAGIC SYNC
        />
      )}
    </div>
  );
}