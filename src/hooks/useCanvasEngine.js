import { useRef, useCallback, useEffect } from 'react';

export const useCanvasEngine = ({
  stageScale, stagePos, setStagePos, setStageScale, dimensions,
  appMode, activeTool, setActiveTool, 
  shapes, setShapes, updateAndCommit,
  setSelectedId, setActiveCommentId,
  brushColor, strokeOpacity, brushSize, fillEnabled, fillColor, fillOpacity,
  containerRef, setPasteMenuPos, onToggleList
}) => {
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const preventClick = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastCenter = useRef(null);
  const lastDist = useRef(0);
  const animationRef = useRef(null);
  
  const currentFreehandId = useRef(null);
  const lastClickTime = useRef(0); 

  const isSpacePressed = useRef(false);

  // 👉 NEW: Change cursor to grab hand instantly when Space is held
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && appMode !== 'viewer') {
        isSpacePressed.current = true;
        if (containerRef.current && !isPanning.current) containerRef.current.style.cursor = 'grab';
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false;
        if (containerRef.current && !isPanning.current) {
          containerRef.current.style.cursor = activeTool === 'pan' || appMode === 'viewer' ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair';
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [activeTool, appMode, containerRef]);

  const getRelativePointerPosition = (stage) => {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert(); 
    return transform.point(stage.getPointerPosition());
  };

  const commitFreehand = useCallback(() => {
    if (currentFreehandId.current) {
      const finishedId = currentFreehandId.current;
      currentFreehandId.current = null;
      isDrawing.current = false;
      updateAndCommit(p => p); 
      setSelectedId(finishedId);
      setActiveCommentId(finishedId);
      setActiveTool('select'); 
    }
  }, [setActiveTool, setSelectedId, setActiveCommentId, updateAndCommit]);

  const changeTool = useCallback((newTool) => {
    // 1. Existing Freehand logic
    if (activeTool === 'freehand' && currentFreehandId.current) {
      commitFreehand(); 
      return; 
    }

    // 👉 2. THE NEW FIX: Intelligent Poly Auto-Close
    if (activeTool === 'line' && isDrawing.current) {
      const currentLine = shapes[shapes.length - 1];
      
      if (currentLine && currentLine.type === 'line' && currentLine.points) {
        // Slice off the trailing cursor segment (2 coordinates)
        const actualPoints = currentLine.points.slice(0, -2);
        
        // Check if there are at least 3 distinct dots (6 coordinates)
        if (actualPoints.length < 6) {
          // Not enough points to form a frame -> TRASH IT
          updateAndCommit((prevShapes) => {
            const newShapes = [...prevShapes];
            newShapes.pop();
            return newShapes;
          });
        } else {
          // Valid frame -> CLOSE IT, SELECT IT, AND ABORT TOOL SWITCH
          updateAndCommit((prevShapes) => {
            const newShapes = [...prevShapes];
            const lineToUpdate = { ...newShapes[newShapes.length - 1] };
            lineToUpdate.points = actualPoints;
            lineToUpdate.isFinished = true;
            lineToUpdate.closed = true;
            newShapes[newShapes.length - 1] = lineToUpdate;
            return newShapes;
          });
          
          isDrawing.current = false;
          currentFreehandId.current = null;
          setSelectedId(currentLine.id);
          setActiveCommentId(currentLine.id);
          setActiveTool('select');
          
          return; // 👈 EXIT HERE! Force them to deal with the comment box!
        }
      }
    }

    // 3. Standard tool switch reset
    isDrawing.current = false; // Safety net
    currentFreehandId.current = null; 
    setSelectedId(null); 
    setActiveCommentId(null); 
    setActiveTool(newTool);
    
  // 👇 CRITICAL: Added 'shapes' to this dependency array so we can read the line!
  }, [activeTool, shapes, commitFreehand, setActiveTool, setSelectedId, setActiveCommentId, updateAndCommit]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    if (animationRef.current) cancelAnimationFrame(animationRef.current); 
    const stage = e.target.getStage();
    if (e.evt.ctrlKey || e.evt.buttons === 4) {
      const scaleBy = 1.1; 
      const oldScale = stage.scaleX(); 
      const pointer = stage.getPointerPosition();
      const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      setStageScale(newScale); 
      setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    } else {
      setStagePos((prev) => ({ x: prev.x - e.evt.deltaX, y: prev.y - e.evt.deltaY }));
    }
  }, [setStageScale, setStagePos]);

  const cleanupGhostStroke = useCallback(() => {
    if (isDrawing.current && activeTool !== 'line') {
      isDrawing.current = false;
      setShapes(prev => {
        if (prev.length === 0) return prev;
        const newShapes = [...prev]; 
        const last = { ...newShapes[newShapes.length - 1] }; 
        if (activeTool === 'freehand' && currentFreehandId.current === last.id) {
          last.lines = last.lines ? last.lines.slice(0, -1) : [];
          if (last.lines.length === 0) {
            newShapes.pop(); 
            currentFreehandId.current = null; 
          } else { 
            newShapes[newShapes.length - 1] = last; 
          }
        } else { 
          newShapes.pop(); 
        }
        return newShapes;
      });
    }
  }, [activeTool, setShapes]);

  const handlePointerDown = useCallback((e) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current); 
    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);
    
    if (e.evt.touches && e.evt.touches.length > 1) { 
      preventClick.current = true; isPanning.current = false; lastCenter.current = null; cleanupGhostStroke(); return; 
    }
    preventClick.current = false;

    // 👉 NEW: Right Click = Toggle List
    if (e.evt.button === 2) {
      e.evt.preventDefault();
      if (onToggleList) onToggleList();
      return;
    }

    // 👉 NEW: Pan if Middle Click OR Space+Left Click
    const isPanShortcut = isSpacePressed.current && e.evt.button === 0;
    
    if (e.evt.button === 1 || activeTool === 'pan' || appMode === 'viewer' || isPanShortcut) { 
      e.evt.preventDefault(); isPanning.current = true; preventClick.current = true; 
      // 👉 THE FIX: Forcefully drop the shape so it doesn't drag during a pan!
      if (e.target && typeof e.target.stopDrag === 'function') {
        e.target.stopDrag();
      }
      const clientX = e.evt.touches ? e.evt.touches[0].clientX : e.evt.clientX;
      const clientY = e.evt.touches ? e.evt.touches[0].clientY : e.evt.clientY;
      lastMousePos.current = { x: clientX, y: clientY };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
      return;
    }
    
    if (activeTool === 'select') {
      const isTransformer = e.target.getParent() && e.target.getParent().className === 'Transformer';
      const isVertex = e.target.className === 'Circle' && !e.target.id()?.startsWith('badge-');
      if (isTransformer || isVertex) return; 
      let target = e.target; 
      while (target && !target.id()) target = target.getParent();
      let clickedId = target ? target.id() : null;

      if (!clickedId || e.target === stage || e.target.attrs.image) { 
        setSelectedId(null); 
        setActiveCommentId(null); 
        if (setPasteMenuPos) setPasteMenuPos({ x: pos.x, y: pos.y }); 
        updateAndCommit(p => p); 
        return; 
      }
      
      if (setPasteMenuPos) setPasteMenuPos(null);

      if (clickedId.startsWith('badge-')) { 
        const shapeId = clickedId.replace('badge-', ''); 
        setSelectedId(shapeId); 
        setActiveCommentId(shapeId); 
      } else { 
        setSelectedId(clickedId); 
        setActiveCommentId(null); 
      }
      return;
    }

    if (activeTool === 'rect') {
      isDrawing.current = true;
      setShapes(prev => [...prev, { id: Date.now().toString(), type: 'rect', title: '', comment: '', parentId: null, color: brushColor, strokeOpacity: strokeOpacity, fill: fillEnabled ? fillColor : null, fillOpacity: fillOpacity, x: pos.x, y: pos.y, width: 0, height: 0, thickness: brushSize }]);
    }

    if (activeTool === 'arrow') {
      if (isDrawing.current) {
        isDrawing.current = false;
        updateAndCommit((prevShapes) => {
          if (prevShapes.length === 0) return prevShapes; // 👉 Safety Check
          
          const newShapes = [...prevShapes]; 
          const shape = { ...newShapes[newShapes.length - 1] };
          
          // 👉 Safety Check: Abort if it's the wrong shape or missing points
          if (!shape || shape.type !== 'arrow' || !shape.points || shape.points.length < 2) return prevShapes;
          
          shape.points = [shape.points[0], shape.points[1], pos.x, pos.y]; 
          shape.isFinished = true; 
          newShapes[newShapes.length - 1] = shape;
          setSelectedId(shape.id); 
          setActiveCommentId(shape.id); 
          setActiveTool('select'); 
          return newShapes;
        });
        return; 
      }
      isDrawing.current = true;
      setShapes(prev => [...prev, { id: Date.now().toString(), type: 'arrow', title: '', comment: '', parentId: null, color: brushColor, strokeOpacity: strokeOpacity, fill: fillEnabled ? fillColor : null, fillOpacity: fillOpacity, points: [pos.x, pos.y, pos.x, pos.y], thickness: brushSize }]);
    }

    // 👉 PERFECT FREEHAND FIX: Setup initial array state
    if (activeTool === 'freehand') {
      isDrawing.current = true;
      // Start the array with two points close together so it registers as a dot if they just tap
      const newStrokeObj = { 
        points: [pos.x, pos.y, pos.x + 0.1, pos.y + 0.1], 
        thickness: brushSize, 
        color: brushColor, 
        strokeOpacity: strokeOpacity 
      };
      
      setShapes(prev => {
        const exists = currentFreehandId.current ? prev.some(s => s.id === currentFreehandId.current) : false;
        if (exists) {
          return prev.map(s => s.id === currentFreehandId.current ? { ...s, lines: [...(s.lines || []), newStrokeObj] } : s);
        } else {
          const newId = Date.now().toString(); 
          currentFreehandId.current = newId;
          return [...prev, { id: newId, type: 'freehand', title: '', comment: '', parentId: null, color: brushColor, strokeOpacity: strokeOpacity, thickness: brushSize, lines: [newStrokeObj] }];
        }
      });
    }

    if (activeTool === 'lasso') {
      isDrawing.current = true;
      setShapes(prev => [...prev, { id: Date.now().toString(), type: 'lasso', title: '', comment: '', parentId: null, color: brushColor, strokeOpacity: strokeOpacity, fill: fillEnabled ? fillColor : null, fillOpacity: fillOpacity, points: [pos.x, pos.y, pos.x, pos.y], thickness: brushSize, isFinished: false, closed: false }]);
    }

    
  }, [activeTool, appMode, brushColor, brushSize, fillEnabled, fillColor, fillOpacity, setShapes, setActiveCommentId, setSelectedId, strokeOpacity, updateAndCommit, containerRef, cleanupGhostStroke, setPasteMenuPos]);

  const handlePointerMove = useCallback((e) => {
    const touch1 = e.evt.touches ? e.evt.touches[0] : null; 
    const touch2 = e.evt.touches ? e.evt.touches[1] : null;

    if (touch1 && touch2) {
      e.evt.preventDefault(); preventClick.current = true; isPanning.current = false; cleanupGhostStroke(); 
      const stage = e.target.getStage();
      const p1 = { x: touch1.clientX, y: touch1.clientY }; const p2 = { x: touch2.clientX, y: touch2.clientY };
      const getDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const getCenter = (p1, p2) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
      const newCenter = getCenter(p1, p2); const dist = getDistance(p1, p2);
      if (!lastCenter.current) { lastCenter.current = newCenter; lastDist.current = dist; return; }
      
      const dx = newCenter.x - lastCenter.current.x; const dy = newCenter.y - lastCenter.current.y;
      const scaleBy = dist / lastDist.current; const oldScale = stage.scaleX(); const newScale = oldScale * scaleBy;
      const pointTo = { x: (newCenter.x - stage.x()) / oldScale, y: (newCenter.y - stage.y()) / oldScale };
      
      setStageScale(newScale); setStagePos({ x: newCenter.x - pointTo.x * newScale + dx, y: newCenter.y - pointTo.y * newScale + dy });
      lastCenter.current = newCenter; lastDist.current = dist; return;
    }

    if (isPanning.current) {
      e.evt.preventDefault(); preventClick.current = true;
      const clientX = touch1 ? touch1.clientX : e.evt.clientX; const clientY = touch1 ? touch1.clientY : e.evt.clientY;
      const dx = clientX - lastMousePos.current.x; const dy = clientY - lastMousePos.current.y;
      setStagePos((prev) => ({ x: prev.x + dx, y: prev.y + dy })); lastMousePos.current = { x: clientX, y: clientY }; return;
    }

    if (!isDrawing.current || appMode === 'viewer') return;

    const stage = e.target.getStage(); 
    const pos = getRelativePointerPosition(stage);

    setShapes((prevShapes) => {
      if (prevShapes.length === 0) return prevShapes;
      const newShapes = [...prevShapes]; 
      const currentShape = { ...newShapes[newShapes.length - 1] };
      
      if (currentShape.type === 'rect') { 
        currentShape.width = pos.x - currentShape.x; 
        currentShape.height = pos.y - currentShape.y; 
      }
      
      // 👉 PERFECT FREEHAND FIX: Append points directly to array without distance checks
      if (currentShape.type === 'freehand') {
        const lines = [...(currentShape.lines || [])];
        if (lines.length > 0) {
          const lastIndex = lines.length - 1; 
          const lastLineObj = { ...lines[lastIndex] }; 
          
          // We don't filter by distance here because perfect-freehand relies on the frequency 
          // of events to calculate velocity (which drives the thinning effect).
          lastLineObj.points = [...lastLineObj.points, pos.x, pos.y]; 
          lines[lastIndex] = lastLineObj; 
          currentShape.lines = lines;
        }
      }

      if (currentShape.type === 'lasso') {
        const len = currentShape.points.length;
        if (Math.sqrt(Math.pow(pos.x - currentShape.points[len - 2], 2) + Math.pow(pos.y - currentShape.points[len - 1], 2)) > 5) { 
          currentShape.points = [...currentShape.points, pos.x, pos.y]; 
        }
      }

      if (currentShape.type === 'eraser') {
        const len = currentShape.points.length;
        if (Math.sqrt(Math.pow(pos.x - currentShape.points[len - 2], 2) + Math.pow(pos.y - currentShape.points[len - 1], 2)) > 5) { 
          currentShape.points = [...currentShape.points, pos.x, pos.y]; 
        }
      }

      if (currentShape.type === 'line' || currentShape.type === 'arrow') {
        const newPoints = [...currentShape.points]; 
        const len = newPoints.length;
        newPoints[len - 2] = pos.x; 
        newPoints[len - 1] = pos.y; 
        currentShape.points = newPoints;
      }
      
      newShapes[newShapes.length - 1] = currentShape; 
      return newShapes;
    });
  }, [appMode, setShapes, setStagePos, setStageScale, cleanupGhostStroke]);

  const handlePointerUp = useCallback((e) => {
    if (e.evt.touches && e.evt.touches.length === 1 && appMode === 'viewer') {
      isPanning.current = true; lastMousePos.current = { x: e.evt.touches[0].clientX, y: e.evt.touches[0].clientY }; lastCenter.current = null; return;
    }

    if (isPanning.current) {
      isPanning.current = false;
      // 👉 NEW: Check Space state to reset cursor accurately
      if (containerRef.current) {
        containerRef.current.style.cursor = activeTool === 'pan' || appMode === 'viewer' || isSpacePressed.current ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair';
      }
    }
    lastCenter.current = null; lastDist.current = 0;

    if (preventClick.current) { 
      if (!e.evt.touches || e.evt.touches.length === 0) { 
        setTimeout(() => { preventClick.current = false; }, 300); 
      } 
      return; 
    }

    if (isDrawing.current && (activeTool === 'rect' || activeTool === 'arrow' || activeTool === 'freehand' || activeTool === 'eraser' || activeTool === 'lasso')) {
      if (activeTool === 'freehand' || activeTool === 'eraser') {
        isDrawing.current = false; 
        updateAndCommit(p => p); 
        return;
      }

      if (activeTool === 'rect') {
        isDrawing.current = false;
        updateAndCommit((prevShapes) => {
          const newShapes = [...prevShapes]; 
          const finishedId = newShapes[newShapes.length - 1].id;
          setSelectedId(finishedId); 
          setActiveCommentId(finishedId); 
          setActiveTool('select'); 
          return newShapes;
        });
        return;
      }

      if (activeTool === 'lasso') {
        isDrawing.current = false;
        updateAndCommit((prevShapes) => {
          if (prevShapes.length === 0) return prevShapes; // 👉 Safety Check
          
          const newShapes = [...prevShapes]; 
          const shape = { ...newShapes[newShapes.length - 1] };
          
          // 👉 Safety Check
          if (!shape || shape.type !== 'lasso') return prevShapes;
          
          shape.isFinished = true; 
          shape.closed = true; 
          newShapes[newShapes.length - 1] = shape;
          setSelectedId(shape.id); 
          setActiveCommentId(shape.id); 
          setActiveTool('select'); 
          return newShapes;
        });
        return;
      }

      if (activeTool === 'arrow') {
        const currentShape = shapes[shapes.length - 1];
        if (!currentShape || currentShape.type !== 'arrow') return;
        
        const dist = Math.sqrt(Math.pow(currentShape.points[2] - currentShape.points[0], 2) + Math.pow(currentShape.points[3] - currentShape.points[1], 2));

        if (dist > 5) {
          isDrawing.current = false;
          updateAndCommit((prevShapes) => {
            const newShapes = [...prevShapes]; 
            const shape = { ...newShapes[newShapes.length - 1] };
            shape.isFinished = true; 
            newShapes[newShapes.length - 1] = shape;
            setSelectedId(shape.id); 
            setActiveCommentId(shape.id); 
            setActiveTool('select'); 
            return newShapes;
          });
        }
      }
    }
  }, [activeTool, appMode, setActiveCommentId, setSelectedId, setActiveTool, updateAndCommit, containerRef, shapes]);

  const handleStageClick = useCallback((e) => {
    if (appMode === 'viewer' || preventClick.current || activeTool !== 'line') return; 
    
    const now = Date.now(); 
    const isDoubleTap = (now - lastClickTime.current) < 200; 
    lastClickTime.current = now;
    const stage = e.target.getStage(); 
    const pos = getRelativePointerPosition(stage);

    if (isDrawing.current) {
      const currentLine = shapes[shapes.length - 1];
      if (!currentLine || currentLine.type !== 'line') { isDrawing.current = false; return; }

      if (isDoubleTap) {
        isDrawing.current = false;
        updateAndCommit((prevShapes) => {
          if (prevShapes.length === 0) return prevShapes; // 👉 Safety Check
          
          const newShapes = [...prevShapes]; 
          const line = { ...newShapes[newShapes.length - 1] };
          
          // 👉 Safety Check
          if (!line || line.type !== 'line' || !line.points) return prevShapes;
          
          line.points = line.points.slice(0, -2);
          if(line.points.length < 4) { newShapes.pop(); return newShapes; } 
          line.isFinished = true; 
          line.closed = true; 
          newShapes[newShapes.length - 1] = line;
          setSelectedId(line.id); 
          setActiveCommentId(line.id); 
          setActiveTool('select'); 
          return newShapes;
        });
        return;
      }

      const startX = currentLine.points[0]; 
      const startY = currentLine.points[1];
      const distanceToStart = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));

      if (currentLine.points.length >= 6 && distanceToStart < 15 / stageScale) {
        isDrawing.current = false;
        updateAndCommit((prevShapes) => {
          if (prevShapes.length === 0) return prevShapes; // 👉 Safety Check
          
          const newShapes = [...prevShapes]; 
          const line = { ...newShapes[newShapes.length - 1] };
          
          // 👉 Safety Check
          if (!line || line.type !== 'line' || !line.points) return prevShapes;
          
          line.points = [...line.points.slice(0, -2), startX, startY]; 
          line.isFinished = true; 
          line.closed = true; 
          newShapes[newShapes.length - 1] = line; 
          setSelectedId(line.id); 
          setActiveCommentId(line.id); 
          setActiveTool('select'); 
          return newShapes;
        });
      } else {
        setShapes((prev) => {
          const newShapes = [...prev]; 
          const line = { ...newShapes[newShapes.length - 1] };
          line.points = [...line.points.slice(0, -2), pos.x, pos.y, pos.x, pos.y]; 
          newShapes[newShapes.length - 1] = line; 
          return newShapes;
        });
      }
    } else {
      isDrawing.current = true;
      setShapes(prev => [...prev, { id: Date.now().toString(), type: 'line', title: '', comment: '', parentId: null, color: brushColor, strokeOpacity: strokeOpacity, fill: fillEnabled ? fillColor : null, fillOpacity: fillOpacity, points: [pos.x, pos.y, pos.x, pos.y], thickness: brushSize, isFinished: false, closed: false }]);
    }
  }, [activeTool, appMode, brushColor, brushSize, fillEnabled, fillColor, fillOpacity, setShapes, setActiveCommentId, setSelectedId, setActiveTool, shapes, stageScale, strokeOpacity, updateAndCommit]);

  const handleDblClick = useCallback(() => {
    if (appMode === 'viewer') return;
    if (activeTool === 'line' && isDrawing.current) {
      isDrawing.current = false;
      updateAndCommit((prevShapes) => {
        const newShapes = [...prevShapes]; 
        const currentLine = { ...newShapes[newShapes.length - 1] };
        if (currentLine.type !== 'line') return prevShapes;
        currentLine.points = currentLine.points.slice(0, -2); 
        currentLine.isFinished = true; 
        currentLine.closed = true; 
        newShapes[newShapes.length - 1] = currentLine;
        setSelectedId(currentLine.id); 
        setActiveCommentId(currentLine.id); 
        setActiveTool('select'); 
        return newShapes;
      });
    }
  }, [activeTool, appMode, setActiveCommentId, setSelectedId, setActiveTool, updateAndCommit]);

  const handleShapeDragEnd = useCallback((e, id) => {
    const node = e.target; 
    if (node.className === 'Circle' || node.className === 'Text') return;
    updateAndCommit((prevShapes) => prevShapes.map((shape) => {
      if (shape.id === id) {
        if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand' || shape.type === 'lasso') {
          const dx = node.x() - (shape.x || 0); 
          const dy = node.y() - (shape.y || 0);
          if (shape.type === 'freehand' && shape.lines) {
            const newLines = shape.lines.map(lineObj => ({ ...lineObj, points: (lineObj.points || []).map((p, i) => i % 2 === 0 ? p + dx : p + dy) }));
            node.x(0); node.y(0); 
            return { ...shape, lines: newLines, x: 0, y: 0 };
          }
          const newPoints = shape.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy); 
          node.x(0); node.y(0); 
          return { ...shape, points: newPoints, x: 0, y: 0 };
        }
        return { ...shape, x: node.x(), y: node.y() };
      }
      return shape;
    }));
  }, [updateAndCommit]);

  const handleTransformEnd = useCallback((e, id) => {
    const node = e.target;
    updateAndCommit((prevShapes) => prevShapes.map((shape) => {
      if (shape.id === id) return { ...shape, x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY(), rotation: node.rotation() };
      return shape;
    }));
  }, [updateAndCommit]);

  const handleVertexDrag = useCallback((e, shapeId, pointIndex) => {
    const node = e.target;
    setShapes((prevShapes) => prevShapes.map((shape) => {
      if (shape.id === shapeId) {
        const newPoints = [...shape.points]; 
        newPoints[pointIndex] = node.x(); 
        newPoints[pointIndex + 1] = node.y(); 
        return { ...shape, points: newPoints };
      }
      return shape;
    }));
  }, [setShapes]);

  return {
    handleWheel, handlePointerDown, handlePointerMove, handlePointerUp,
    handleStageClick, handleDblClick, handleShapeDragEnd, handleTransformEnd, handleVertexDrag,
    animationRef, changeTool, commitFreehand, hasActiveFreehand: !!currentFreehandId.current, activeFreehandId: currentFreehandId.current,
    abortCurrentDraw: cleanupGhostStroke
  };
};