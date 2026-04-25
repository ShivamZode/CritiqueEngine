import { useRef, useCallback, useEffect } from 'react';

export function useCanvasCamera({
  stageRef, 
  stagePos, setStagePos,
  stageScale, setStageScale,
  stageRotation, setStageRotation,
  dimensions, imageObj, appMode,
  onPresentationStep,
  canvasEvents, containerRef, 
  setShapes, getShapeBounds,
  activeTool, setActiveTool, isRotationEnabled, isTouchRotationEnabled,setSelectedId, 
  setActiveCommentId, selectedId, 
  activeCommentId
}) {
  
  const touchStateRef = useRef({ dist: null, angle: null, mid: null });
  const wheelTimeoutRef = useRef(null);
  const animationRef = useRef(null);
  const gestureRotationRef = useRef(null); 
  
  // 👉 1. Add ignoreUntilAllLifted to the ref
  const pointerPosRef = useRef({ 
    x: 0, y: 0, isMultiTouch: false, isPanning: false, stageStartX: 0, stageStartY: 0, ignoreUntilAllLifted: false, 
    prePanSelectedId: null, prePanActiveCommentId: null 
  });
  const isSpacePressed = useRef(false);
  const isWheelPressed = useRef(false);
  const isRPressed = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e) => { 
      if (e.code === 'Space') {
        isSpacePressed.current = true; 
        if (gestureRotationRef.current === null) gestureRotationRef.current = stageRef?.current?.rotation() || 0;
      }
      if (e.code === 'KeyR') {
        isRPressed.current = true; 
        if (gestureRotationRef.current === null) gestureRotationRef.current = stageRef?.current?.rotation() || 0;
      }
    };
    
    const handleKeyUp = (e) => { 
      if (e.code === 'Space') {
        isSpacePressed.current = false; 
        if (!isWheelPressed.current && !isRPressed.current) gestureRotationRef.current = null;
      }
      if (e.code === 'KeyR') {
        isRPressed.current = false; 
        if (!isWheelPressed.current && !isSpacePressed.current) gestureRotationRef.current = null;
      }
    };
    
    const handleMouseDown = (e) => { 
      if (e.button === 1) { 
        e.preventDefault(); 
        isWheelPressed.current = true; 
        if (gestureRotationRef.current === null) gestureRotationRef.current = stageRef?.current?.rotation() || 0;
      }
    };
    const handleMouseUp = (e) => { 
      if (e.button === 1) {
        isWheelPressed.current = false; 
        if (!isSpacePressed.current && !isRPressed.current) gestureRotationRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    return () => { 
      window.removeEventListener('keydown', handleKeyDown); 
      window.removeEventListener('keyup', handleKeyUp); 
      window.removeEventListener('mousedown', handleMouseDown); 
      window.removeEventListener('mouseup', handleMouseUp); 
    };
  }, [stageRef]);

  // 👉 OPTIMIZED: Direct Mutation Animation
  const resetCamera = useCallback(() => {
    gestureRotationRef.current = null; 
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const stage = stageRef?.current;
    if (!stage) return;

    const startX = stage.x();
    const startY = stage.y();
    const startScale = stage.scaleX();
    const startRot = stage.rotation();

    const finalTargetScale = Math.min(
      dimensions.width / (imageObj?.width || dimensions.width),
      dimensions.height / (imageObj?.height || dimensions.height)
    ) * 0.9;

    const targetX = (dimensions.width - (imageObj?.width || 0) * finalTargetScale) / 2;
    const targetY = (dimensions.height - (imageObj?.height || 0) * finalTargetScale) / 2;

    const startTime = performance.now();
    const duration = 600;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentScale = startScale + (finalTargetScale - startScale) * ease;
      const currentX = startX + (targetX - startX) * ease;
      const currentY = startY + (targetY - startY) * ease;
      const currentRot = startRot + (0 - startRot) * ease;

      // 1. Update Canvas directly
      stage.scale({ x: currentScale, y: currentScale });
      stage.position({ x: currentX, y: currentY });
      stage.rotation(currentRot);
      stage.batchDraw();

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // 2. Sync React State ONCE at the end!
        setStageScale(currentScale);
        setStagePos({ x: currentX, y: currentY });
        setStageRotation(currentRot);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [dimensions, imageObj, stageRef, setStagePos, setStageScale, setStageRotation]);

  // 👉 OPTIMIZED: Direct Mutation Animation
  const focusOnShape = useCallback((shapeId, doZoom = false, align = 'center') => {
    setShapes((currentShapes) => {
      const targetShape = currentShapes.find(s => s.id === shapeId);
      if (!targetShape) return currentShapes;

      const bounds = getShapeBounds(targetShape);
      
      let targetLocalX = bounds.x + (bounds.w / 2);
      let targetLocalY = bounds.y + (bounds.h / 2);

      if (align === 'top-left') {
        targetLocalX = bounds.x;
        targetLocalY = bounds.y;
      }

      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      const stage = stageRef?.current;
      if (!stage) return currentShapes;

      const startX = stage.x();
      const startY = stage.y();
      const startScale = stage.scaleX();
      
      let finalTargetScale = startScale;
      if (doZoom) {
        const optimalScaleX = (dimensions.width * 0.6) / (bounds.w || 100);
        const optimalScaleY = (dimensions.height * 0.6) / (bounds.h || 100);
        finalTargetScale = Math.min(optimalScaleX, optimalScaleY, 2.5);
      }

      const currentRot = stage.rotation();
      const rad = currentRot * (Math.PI / 180);
      
      const scaledX = targetLocalX * finalTargetScale;
      const scaledY = targetLocalY * finalTargetScale;
      
      const rotatedX = (scaledX * Math.cos(rad)) - (scaledY * Math.sin(rad));
      const rotatedY = (scaledX * Math.sin(rad)) + (scaledY * Math.cos(rad));

      const targetX = (dimensions.width / 2) - rotatedX;
      const targetY = (dimensions.height / 2) - rotatedY;

      const startTime = performance.now();
      const duration = 600;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentScale = startScale + (finalTargetScale - startScale) * ease;
        const currentX = startX + (targetX - startX) * ease;
        const currentY = startY + (targetY - startY) * ease;

        // 1. Update Canvas directly
        stage.scale({ x: currentScale, y: currentScale });
        stage.position({ x: currentX, y: currentY });
        stage.batchDraw();

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // 2. Sync React State ONCE at the end!
          setStageScale(currentScale);
          setStagePos({ x: currentX, y: currentY });
        }
      };

      animationRef.current = requestAnimationFrame(animate);
      return currentShapes;
    });
  }, [dimensions, setShapes, getShapeBounds, stageRef, setStagePos, setStageScale]);

  const handlePointerDownWrapper = useCallback((e) => {
    if (e.evt) {
      if (e.evt.touches && e.evt.touches.length >= 2) {
        pointerPosRef.current.isMultiTouch = true;
        pointerPosRef.current.isPanning = false;
        pointerPosRef.current.ignoreUntilAllLifted = true; 

        if (e.target && typeof e.target.stopDrag === 'function') e.target.stopDrag();
        if (canvasEvents?.abortCurrentDraw) canvasEvents.abortCurrentDraw();

        // 👉 1. THE MEMORY BANK: Save the selection before we kill it!
        if (!pointerPosRef.current.prePanSelectedId && selectedId) {
          pointerPosRef.current.prePanSelectedId = selectedId;
          pointerPosRef.current.prePanActiveCommentId = activeCommentId;
        }

        if (setSelectedId) setSelectedId(null);
        if (setActiveCommentId) setActiveCommentId(null);
        
        if (stageRef?.current) {
          stageRef.current.listening(false);
          const transformers = stageRef.current.find('Transformer');
          if (transformers) transformers.forEach(tr => { if (typeof tr.stopTransform === 'function') tr.stopTransform(); });
        }

        const t1 = e.evt.touches[0];
        const t2 = e.evt.touches[1];
        
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const p1 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };
        const p2 = { x: t2.clientX - rect.left, y: t2.clientY - rect.top };

        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

        touchStateRef.current = { dist, angle, mid };
        gestureRotationRef.current = stageRef?.current?.rotation() || 0; 
        
        return; 
      } else {
        if (pointerPosRef.current.ignoreUntilAllLifted) return;

        pointerPosRef.current.prePanSelectedId = selectedId;
        pointerPosRef.current.prePanActiveCommentId = activeCommentId;

        pointerPosRef.current.isMultiTouch = false;
        pointerPosRef.current.x = e.evt.touches ? e.evt.touches[0]?.clientX : e.evt.clientX;
        pointerPosRef.current.y = e.evt.touches ? e.evt.touches[0]?.clientY : e.evt.clientY;
        touchStateRef.current = { dist: null, angle: null, mid: null };

        if (e.evt.button !== 2 && (activeTool === 'pan' || appMode === 'viewer' || e.evt.button === 1)) {
          pointerPosRef.current.isPanning = true;
          pointerPosRef.current.stageStartX = stageRef?.current?.x() || 0;
          pointerPosRef.current.stageStartY = stageRef?.current?.y() || 0;

          // 👉 2. THE MEMORY BANK: Also save it for single-finger/mouse panning!
          pointerPosRef.current.prePanSelectedId = selectedId;
          pointerPosRef.current.prePanActiveCommentId = activeCommentId;

          if (setSelectedId) setSelectedId(null);
          if (setActiveCommentId) setActiveCommentId(null);
          
          if (stageRef?.current) stageRef.current.listening(false); 
          return; 
        } else {
          pointerPosRef.current.isPanning = false;
        }
      }
    }
    if (canvasEvents?.handlePointerDown) canvasEvents.handlePointerDown(e);
  }, [canvasEvents, containerRef, stageRef, activeTool, appMode, setSelectedId, setActiveCommentId, selectedId, activeCommentId]);

  const handleStageClickWrapper = useCallback((e) => {
    if (appMode === 'viewer') {
      let clientX;
      if (e.evt) {
        if (pointerPosRef.current.isMultiTouch) return;
        clientX = e.evt.changedTouches ? e.evt.changedTouches[0]?.clientX : e.evt.clientX;
        const clientY = e.evt.changedTouches ? e.evt.changedTouches[0]?.clientY : e.evt.clientY;
        const dx = clientX - pointerPosRef.current.x;
        const dy = clientY - pointerPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) return;
      } else {
        clientX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX);
      }

      if (clientX !== undefined) {
        if (clientX < window.innerWidth / 2) onPresentationStep('prev');
        else onPresentationStep('next');
      }
    } else {
      if (e.evt && (e.evt.button === 1 || e.evt.button === 2)) return;
      if (pointerPosRef.current.isMultiTouch || pointerPosRef.current.isPanning || pointerPosRef.current.ignoreUntilAllLifted) return;

      if (e.evt && canvasEvents?.handleStageClick) canvasEvents.handleStageClick(e);
    }
  }, [appMode, onPresentationStep, canvasEvents]);

  const handlePointerMoveWrapper = useCallback((e) => {
    // 👉 THE FIX: If they lifted one finger of a pan, block the trailing finger from drawing!
    if (pointerPosRef.current.ignoreUntilAllLifted && e.evt && e.evt.touches && e.evt.touches.length < 2) {
      return; 
    }

    if (pointerPosRef.current.isPanning && stageRef.current && e.evt) {
      const clientX = e.evt.touches ? e.evt.touches[0]?.clientX : e.evt.clientX;
      const clientY = e.evt.touches ? e.evt.touches[0]?.clientY : e.evt.clientY;

      const dx = clientX - pointerPosRef.current.x;
      const dy = clientY - pointerPosRef.current.y;

      stageRef.current.position({
        x: pointerPosRef.current.stageStartX + dx,
        y: pointerPosRef.current.stageStartY + dy
      });
      stageRef.current.batchDraw();
      
      return; 
    }

    if (canvasEvents?.handlePointerMove) canvasEvents.handlePointerMove(e);
  }, [canvasEvents, stageRef]);

  const handleTouchMoveWrapper = useCallback((e) => {
    if (e.evt && e.evt.touches && e.evt.touches.length === 2) {
      // ... (keep your existing zooming and rotating math here exactly as it is) ...
      e.evt.preventDefault();
      // 👉 THE FIX: Ensure the container actually exists before measuring it!
      if (!containerRef.current) return;

      const t1 = e.evt.touches[0];
      const t2 = e.evt.touches[1];

      const rect = containerRef.current.getBoundingClientRect();
      const midX = ((t1.clientX + t2.clientX) / 2) - rect.left;
      const midY = ((t1.clientY + t2.clientY) / 2) - rect.top;
      
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

      if (touchStateRef.current.dist !== null) {
        const stage = stageRef?.current;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const oldRot = stage.rotation();
        const oldPos = stage.position();

        const scaleChange = dist / touchStateRef.current.dist;
        const newScale = Math.max(0.1, Math.min(oldScale * scaleChange, 10)); 
        
        let newRot = oldRot;

        if (isTouchRotationEnabled) {
          let deltaAngle = angle - touchStateRef.current.angle;
          
          if (deltaAngle > 180) deltaAngle -= 360;
          if (deltaAngle < -180) deltaAngle += 360;
          if (Math.abs(deltaAngle) < 0.5) deltaAngle = 0;

          let accumRot = gestureRotationRef.current !== null ? gestureRotationRef.current : oldRot;
          accumRot += deltaAngle;
          gestureRotationRef.current = accumRot; 

          newRot = accumRot;
          const nearest90 = Math.round(newRot / 90) * 90;
          if (Math.abs(newRot - nearest90) < 6) newRot = nearest90;
        }
            
        const rad = oldRot * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const dx = touchStateRef.current.mid.x - oldPos.x;
        const dy = touchStateRef.current.mid.y - oldPos.y;

        const localX = (dx * cos + dy * sin) / oldScale;
        const localY = (-dx * sin + dy * cos) / oldScale;

        const newRad = newRot * Math.PI / 180;
        const nCos = Math.cos(newRad);
        const nSin = Math.sin(newRad);

        const newPosX = midX - (localX * nCos - localY * nSin) * newScale;
        const newPosY = midY - (localX * nSin + localY * nCos) * newScale;

        stage.scale({ x: newScale, y: newScale });
        stage.rotation(newRot);
        stage.position({ x: newPosX, y: newPosY });
        stage.batchDraw();
      }

      touchStateRef.current = { dist, angle, mid: { x: midX, y: midY } };
      return; 
    }
    
    handlePointerMoveWrapper(e);
  }, [containerRef, stageRef, isTouchRotationEnabled, handlePointerMoveWrapper]);

  const handleWheelWrapper = useCallback((e) => {
    // ... (keep your existing handleWheelWrapper exactly as it is) ...
    if (e.evt) e.evt.preventDefault();
    const stage = stageRef?.current;
    if (!stage) return;

    if (isSpacePressed.current || isRPressed.current || (isRotationEnabled && isWheelPressed.current)) {
      const deltaDeg = e.evt.deltaY > 0 ? -15 : 15;
      
      let pointerX = dimensions.width / 2;
      let pointerY = dimensions.height / 2;
      if (e.evt) { pointerX = e.evt.clientX; pointerY = e.evt.clientY; }

      const oldScale = stage.scaleX();
      const oldRot = stage.rotation();
      const oldPos = stage.position();

      const rad = oldRot * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const dx = pointerX - oldPos.x;
      const dy = pointerY - oldPos.y;

      const localX = (dx * cos + dy * sin) / oldScale;
      const localY = (-dx * sin + dy * cos) / oldScale;

      let accumRot = gestureRotationRef.current !== null ? gestureRotationRef.current : oldRot;
      accumRot += deltaDeg;
      gestureRotationRef.current = accumRot; 

      let newRot = accumRot;
      const nearest90 = Math.round(newRot / 90) * 90;
      if (Math.abs(newRot - nearest90) < 6) newRot = nearest90;

      const newRad = newRot * (Math.PI / 180);
      const nCos = Math.cos(newRad);
      const nSin = Math.sin(newRad);

      const newPosX = pointerX - (localX * nCos - localY * nSin) * oldScale;
      const newPosY = pointerY - (localX * nSin + localY * nCos) * oldScale;

      stage.rotation(newRot);
      stage.position({ x: newPosX, y: newPosY });
      stage.batchDraw();
    } else {
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition() || { x: dimensions.width / 2, y: dimensions.height / 2 };

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.1; 
      const clampedScale = Math.max(0.05, Math.min(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 10));
      
      const newPosX = pointer.x - mousePointTo.x * clampedScale;
      const newPosY = pointer.y - mousePointTo.y * clampedScale;

      stage.scale({ x: clampedScale, y: clampedScale });
      stage.position({ x: newPosX, y: newPosY });
      stage.batchDraw();
    }

    if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    wheelTimeoutRef.current = setTimeout(() => {
      if (stageRef.current) {
        setStageScale(stageRef.current.scaleX());
        setStagePos(stageRef.current.position());
        setStageRotation(stageRef.current.rotation());
      }
    }, 150);
  }, [dimensions, stageRef, isRotationEnabled, setStagePos, setStageScale, setStageRotation]);

  const handlePointerUpWrapper = useCallback((e) => {
    const stage = stageRef?.current;
    
    // We check this BEFORE resetting the flags below so we know if they were panning
    const wasPanning = pointerPosRef.current.isMultiTouch || pointerPosRef.current.isPanning;
    
    if (stage && wasPanning) {
       setStagePos(stage.position());
       setStageScale(stage.scaleX());
       setStageRotation(stage.rotation());
    }

    if (!e.evt || !e.evt.touches || e.evt.touches.length < 2) {
      pointerPosRef.current.isMultiTouch = false;
      pointerPosRef.current.isPanning = false;
      touchStateRef.current = { dist: null, angle: null, mid: null };
      gestureRotationRef.current = null; 

      if (stage) stage.listening(true);

      // 👉 3. THE MAGIC RESTORE: If they were panning, give them their UI back!
      if (wasPanning && pointerPosRef.current.prePanSelectedId) {
        const restoredId = pointerPosRef.current.prePanSelectedId;
        const restoredCommentId = pointerPosRef.current.prePanActiveCommentId;
        
        // We use a 10ms timeout to ensure the canvas has fully un-blindfolded first
        setTimeout(() => {
          if (setSelectedId) setSelectedId(restoredId);
          if (setActiveCommentId) setActiveCommentId(restoredCommentId);
        }, 10);
      }
      
      // Clear the memory bank
      pointerPosRef.current.prePanSelectedId = null;
      pointerPosRef.current.prePanActiveCommentId = null;
    }

    if (!e.evt || !e.evt.touches || e.evt.touches.length === 0) {
      pointerPosRef.current.ignoreUntilAllLifted = false;
    }
    
    if (pointerPosRef.current.ignoreUntilAllLifted) return;
    
    if (canvasEvents?.handlePointerUp) canvasEvents.handlePointerUp(e);
  }, [canvasEvents, stageRef, setStagePos, setStageScale, setStageRotation, setSelectedId, setActiveCommentId]);

  return {
    resetCamera,
    focusOnShape,
    cameraHandlers: {
      onMouseDown: handlePointerDownWrapper,
      onClick: handleStageClickWrapper,
      onTap: handleStageClickWrapper,
      onWheel: handleWheelWrapper,
      onTouchStart: handlePointerDownWrapper,
      onTouchMove: handleTouchMoveWrapper,
      onTouchEnd: handlePointerUpWrapper,
      onMouseUp: handlePointerUpWrapper,
      onMouseLeave: handlePointerUpWrapper,
      onMouseMove: handlePointerMoveWrapper,
    }
  };
}