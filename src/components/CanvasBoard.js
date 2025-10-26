import React, { useState, useEffect, useRef } from 'react';
import { fetchSignatures, storeSignature } from '../lib/signatureService';
import './CanvasBoard.css';
import WelcomeCard from './WelcomeCard';
import CButton from './CButton';

const CANVAS_WIDTH = 3200;
const CANVAS_HEIGHT = 3200;

// --- ORIGINAL HELPERS (for old Point[] data) ---

const getOutlineFromPoints = (points) => {
  if (!points || points.length < 1) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  return { x: minX - 10, y: minY - 10, width: (maxX - minX) + 20, height: (maxY - minY) + 20 };
};

const drawSingleLine = (ctx, points, stroke, width) => {
  if (!points || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
};

// --- NEW HELPERS (for new Point[][] data) ---

const getOutlineFromStrokes = (strokes) => {
  if (!strokes || strokes.length < 1) return null;
  const points = strokes.flat(); // Flatten all strokes into one array of points
  if (points.length < 1) return null;
  return getOutlineFromPoints(points); // Reuse the original logic
};

const drawStrokes = (ctx, strokes, stroke, width) => {
  if (!strokes || strokes.length < 1) return;

  // Iterate over each stroke (which is a Point[]) and draw it
  for (const points of strokes) {
    drawSingleLine(ctx, points, stroke, width); // Reuse the original line drawing function
  }
};

// --- COMMON HELPERS ---

const isPointInsideRect = (point, rect) => {
  if (!rect) return false;
  const [x, y] = point;
  return x >= rect.x && x <= rect.x + rect.width &&
         y >= rect.y && y <= rect.y + rect.height;
};

const drawOutline = (ctx, outline, stroke) => {
  if (!outline) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.strokeRect(outline.x, outline.y, outline.width, outline.height);
  ctx.setLineDash([]);
};

// --- UPDATED UNIVERSAL DRAW FUNCTION ---

const drawSignature = (ctx, line) => {
  // Check data format.
  // A simple check: if the first element is an array, it's Point[][].
  const isMultiStroke = line.points && line.points.length > 0 && 
                          Array.isArray(line.points[0]) && 
                          line.points[0].length > 0 &&
                          Array.isArray(line.points[0][0]);

  if (isMultiStroke) {
    // New format: Point[][]
    drawStrokes(ctx, line.points, "white", 3);
  } else {
    // Old format: Point[]
    drawSingleLine(ctx, line.points, "white", 3);
  }
  
  const captionToDraw = (line.caption && line.caption.trim() !== "") ? line.caption : `#${line.id}`;

  if (captionToDraw && line.outline) {
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 14px sans-serif";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 5;
    ctx.fillText(captionToDraw, line.outline.x, line.outline.y + line.outline.height + 15);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }
};

const exportAsPNG = (lines) => {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = CANVAS_WIDTH;
  exportCanvas.height = CANVAS_HEIGHT;
  const ctx = exportCanvas.getContext('2d');

  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  lines.forEach(line => {
    drawSignature(ctx, line); // This will now work for both formats
  });

  const dataUrl = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'canvas-signatures.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


function CanvasBoard() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasSigned, setHasSigned] = useState(false);
  const [isPanning, setIsPanning] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [centerCoords, setCenterCoords] = useState({ x: 0, y: 0 });
  const [lines, setLines] = useState([]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // State for the single stroke being drawn
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState([]);
  
  // UPDATED: pendingDrawing now holds { strokes: Point[][], outline: Outline }
  const [pendingDrawing, setPendingDrawing] = useState(null);

  const [isEnteringCaption, setIsEnteringCaption] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [captionPos, setCaptionPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const captionInputRef = useRef(null);

  const [isExporting, setIsExporting] = useState(window.location.pathname === '/export');
  const exportTriggeredRef = useRef(false);

  useEffect(() => {
    if (isExporting) {
      setShowWelcome(false);
      setHasSigned(true);
      setToastMessage("Preparing export...");
    }
  }, [isExporting]);

  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
    }
    if (hasSigned) {
      loadSignatures();
    }
  }, [hasSigned]);

  useEffect(() => {
    if (hasSigned) {
      redrawCanvas();
    }
  }, [lines, panOffset, currentDrawingPoints, pendingDrawing, hasSigned]);

  useEffect(() => {
    if (isExporting && hasSigned && lines.length > 0 && !exportTriggeredRef.current) {
      exportTriggeredRef.current = true;
      setToastMessage("Generating PNG...");
      exportAsPNG(lines);
      setToastMessage("Export complete!");
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  }, [lines, hasSigned, isExporting]);

  useEffect(() => {
    if (isEnteringCaption && captionInputRef.current) {
      captionInputRef.current.focus();
    }
  }, [isEnteringCaption]);


  // UPDATED: loadSignatures is now much simpler
  const loadSignatures = async () => {
    try {
      if (!isExporting) {
        setToastMessage("Loading signatures...");
      }
      
      // The service now does ALL the processing (parsing, outline calculation)
      const data = await fetchSignatures(); 

      setLines(data); // The data is ready to be used

      if (!isExporting) {
        setToastMessage("Signatures loaded!");
      }
    } catch (error) {
      setToastMessage("Error loading signatures.");
    } finally {
      if (!isExporting) {
        setTimeout(() => setToastMessage(''), 2000);
      }
    }
  };

  // UPDATED: Redraw logic to handle multi-stroke-in-progress
  const redrawCanvas = () => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Draw all saved signatures (handles both data formats)
    lines.forEach(line => {
      drawSignature(ctx, line);
    });

    // 2. Draw the active stroke being drawn right now
    drawSingleLine(ctx, currentDrawingPoints, "white", 3);
    
    // 3. Draw the in-progress signature (which can be multi-stroke)
    if (pendingDrawing) {
      drawStrokes(ctx, pendingDrawing.strokes, "white", 3);
      drawOutline(ctx, pendingDrawing.outline, "#00A8FF");
    }
  };
  
  // UPDATED: Collision check now ONLY checks saved lines
  const checkCollision = (point) => {
    // Check against saved signatures
    for (const line of lines) {
      if (isPointInsideRect(point, line.outline)) {
        return true;
      }
    }
    // DO NOT check against pendingDrawing.outline
    // This allows the user to draw over their own in-progress work
    return false;
  };

  const getCoords = (e) => {
    if (!canvasRef.current) return [0, 0];
    const rect = canvasRef.current.getBoundingClientRect();
    const event = e.touches ? e.touches[0] : e;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return [x, y];
  };

  const handleSign = () => {
    setShowWelcome(false);
    setHasSigned(true);
  };

  // REVERTED: This is the original togglePanning logic
  const togglePanning = () => {
    if (!isPanning && (currentDrawingPoints.length > 0 || pendingDrawing)) {
      handleCancel();
    }
    setIsPanning(prev => !prev);
    const message = !isPanning ? 'Panning enabled' : 'Drawing enabled';
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2000);
  };
  
  const handleMouseDown = (e) => {
    if (isExporting) return;

    const point = getCoords(e);
    const event = e.touches ? e.touches[0] : e;

    if (isPanning) {
      panStartRef.current = {
        x: event.clientX - panOffset.x,
        y: event.clientY - panOffset.y,
      };
      setIsDragging(true);
    } else { // In "Draw" mode
      // User can draw new strokes even when captioning
      // if (isEnteringCaption) return; 

      // Check collision only against *other* signatures
      if (checkCollision(point)) {
        setToastMessage("You can't draw over an existing signature!");
        setTimeout(() => setToastMessage(''), 2000);
        return;
      }
      
      setIsDrawing(true);
      setCurrentDrawingPoints([point]);
    }
  };

  const handleMouseMove = (e) => {
    if (isExporting) return;

    const [x, y] = getCoords(e);
    const event = e.touches ? e.touches[0] : e;
    
    setCenterCoords({ x: Math.round(x), y: Math.round(y) });

    if (isPanning) {
      if (!isDragging) return;
      const newX = event.clientX - panStartRef.current.x;
      const newY = event.clientY - panStartRef.current.y; 
      
      const clampedX = Math.min(0, Math.max(newX, window.innerWidth - CANVAS_WIDTH));
      const clampedY = Math.min(0, Math.max(newY, window.innerHeight - CANVAS_HEIGHT));
      
      setPanOffset({ x: clampedX, y: clampedY });

    } else { // In "Draw" mode
      if (!isDrawing) return;

      const point = [x, y];
      // Check collision only against *other* signatures
      if (checkCollision(point)) {
        setIsDrawing(false); // Stop drawing this stroke
        
        // Discard this stroke, but keep the pendingDrawing
        setCurrentDrawingPoints([]); 
        
        setToastMessage("You can't draw over an existing signature!");
        setTimeout(() => setToastMessage(''), 2000);
        return;
      }
      
      setCurrentDrawingPoints(prev => [...prev, point]);
    }
  };

  // UPDATED: This is the new multi-stroke-compatible mouseUp
  const handleMouseUp = () => {
    if (isExporting) return;

    if (isPanning) {
      setIsDragging(false);
    } else { // In "Draw" mode
      if (!isDrawing) return;
      setIsDrawing(false);
      
      if (currentDrawingPoints.length < 2) {
        setCurrentDrawingPoints([]); // Discard tiny stroke/click
        return;
      }

      // This is the multi-stroke logic
      if (pendingDrawing) {
        // This is the 2nd, 3rd, etc. stroke
        const newStrokes = [...pendingDrawing.strokes, currentDrawingPoints];
        const newOutline = getOutlineFromStrokes(newStrokes);
        
        setPendingDrawing({
          strokes: newStrokes,
          outline: newOutline
        });
        setCurrentDrawingPoints([]);
        // Modal is already open, just update the drawing

      } else {
        // This is the *first* stroke
        const newStrokes = [currentDrawingPoints];
        const outline = getOutlineFromStrokes(newStrokes);

        setPendingDrawing({
          strokes: newStrokes,
          outline: outline
        });
        setCurrentDrawingPoints([]);
        
        // This triggers the modal, as per the original workflow
        setCaptionPos({ 
          top: `40%`, 
          left: `50%`,
          transform: 'translate(-50%, -50%)',
          position: 'fixed',
        });
        setIsEnteringCaption(true);
      }
    }
  };
  
  const handleMouseLeave = () => {
    if (isExporting) return;

    if (isDragging) setIsDragging(false);
    
    if (isDrawing) { // In "Draw" mode and mouse left canvas
      setIsDrawing(false);
      // Discard the partial stroke
      setCurrentDrawingPoints([]);
    }
  };
  
  // UPDATED: Save logic to send ONLY signature and caption
  const handleFinalSave = async () => {
    if (!pendingDrawing) return;

    const { strokes } = pendingDrawing; // Only need the strokes
    const finalCaption = captionText || null;

    // This object NO LONGER contains x, y, width, height.
    // This fixes the Supabase 400 error.
    const dbEntry = {
      signature: JSON.stringify(strokes), // Save in the new Point[][] format
      caption: finalCaption,
    };

    try {
      setToastMessage("Saving...");
      
      // The service now inserts the simple object and returns
      // the fully processed object (with id, points, outline, etc.)
      const newSignature = await storeSignature(dbEntry); 

      if (newSignature) {
        // The service already added .points and .outline.
        // We just need to make sure the caption is what we submitted.
        const lineInState = {
          ...newSignature,
          caption: finalCaption, // Enforce caption from our state
        };

        setLines(prev => [...prev, lineInState]);
      }
      setToastMessage("Signature saved!");

    } catch (error) {
      setToastMessage("Error saving signature.");
    } finally {
      setPendingDrawing(null);
      setIsEnteringCaption(false);
      setCaptionText("");
      setTimeout(() => setToastMessage(''), 2000);
    }
  };

  // REVERTED: This is the original cancel logic
  const handleCancel = () => {
    setPendingDrawing(null);
    setCurrentDrawingPoints([]);
    setIsEnteringCaption(false);
    setCaptionText("");
    setToastMessage("Drawing canceled");
    setTimeout(() => setToastMessage(''), 2000);
  };
  
  const boardClasses = [
    'canvas-board',
    isPanning ? 'is-panning' : '',
    isPanning && isDragging ? 'is-panning-active' : '',
    !isPanning ? 'is-drawing' : ''
  ].filter(Boolean).join(' ');

  // NEW: Define the disable condition once
  // It should be disabled if: drawing a stroke OR a drawing is pending (needs caption/more strokes).
  const isActionPending = isDrawing || pendingDrawing !== null;

  return (
    <div 
      className={boardClasses}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    >

      {hasSigned && !showWelcome && !isExporting && (
        <>
          <div 
            className="top-left-button"
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
          >
            <CButton 
                label="<" 
                onClick={() => setShowWelcome(true)} 
                // FIX: Implemented the same disable logic here
                disabled={isActionPending}
            />
          </div>
          
          <div 
            className="top-right-button"
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
          >
            <CButton 
              label={isPanning ? 'Sign' : 'Pan'}
              onClick={togglePanning} 
              // UPDATED: Use the new unified disable condition
              disabled={isActionPending}
            />
          </div>
        </>
      )}

      {toastMessage && <div className="toast">{toastMessage}</div>}

      {!isExporting && (
        <div className="coordinates">
          X: {centerCoords.x} | Y: {centerCoords.y}
        </div>
      )}

      {showWelcome && (
        <div className="welcome-card-wrapper">
          <WelcomeCard sign="Sign!" onSign={handleSign} />
        </div>
      )}

      {isEnteringCaption && (
        <div className="caption-input-box" style={captionPos} 
             onMouseDown={e => e.stopPropagation()}
             onTouchStart={e => e.stopPropagation()}
        >
          <input
            ref={captionInputRef}
            type="text"
            placeholder="enter caption (optional)"
            value={captionText}
            onChange={(e) => setCaptionText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFinalSave()}
          />
          <button onClick={handleFinalSave}>Save</button>
          <button onClick={handleCancel} className="cancel-button">Cancel</button>
        </div>
      )}

      {hasSigned && !isExporting && (
        <div 
          className="canvas-wrapper"
          style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="main-canvas"
          />
        </div>
      )}
    </div>
  );
}

export default CanvasBoard;