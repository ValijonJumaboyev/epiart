// EpiArt — Drawing Board Functionality Module (Studio v3)
window.EpiArt = window.EpiArt || {};

(function () {
    let lastEraserPos = null;
    let activeEraserPath = [];

    // Render Vector Input Canvas
    function renderDrawCanvas() {
        const { drawCv, drawCtx, strokes, currentPoints, currentColor, currentWidth, viewDraw, showGuides, symmetryMode, refImage, currentTool, eraserRadius } = EpiArt.state;
        if (!drawCv || !drawCtx) return;

        const rect = drawCv.getBoundingClientRect();
        drawCtx.clearRect(0, 0, drawCv.width, drawCv.height);

        // Apply View Transform (Zoom & Pan)
        drawCtx.save();
        drawCtx.translate(viewDraw.panX, viewDraw.panY);
        drawCtx.scale(viewDraw.zoom, viewDraw.zoom);

        const canvasW = drawCv.width / EpiArt.state.dpr;
        const canvasH = drawCv.height / EpiArt.state.dpr;

        // Background aesthetic grid
        drawCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        drawCtx.lineWidth = 1 / viewDraw.zoom;
        const step = 30;
        const startX = -viewDraw.panX / viewDraw.zoom;
        const startY = -viewDraw.panY / viewDraw.zoom;
        const endX = startX + canvasW / viewDraw.zoom + step;
        const endY = startY + canvasH / viewDraw.zoom + step;

        const gridMinX = Math.floor(startX / step) * step;
        const gridMaxX = Math.ceil(endX / step) * step;
        const gridMinY = Math.floor(startY / step) * step;
        const gridMaxY = Math.ceil(endY / step) * step;

        for (let x = gridMinX; x <= gridMaxX; x += step) {
            drawCtx.beginPath();
            drawCtx.moveTo(x, gridMinY);
            drawCtx.lineTo(x, gridMaxY);
            drawCtx.stroke();
        }
        for (let y = gridMinY; y <= gridMaxY; y += step) {
            drawCtx.beginPath();
            drawCtx.moveTo(gridMinX, y);
            drawCtx.lineTo(gridMaxX, y);
            drawCtx.stroke();
        }

        // Reference Image (Locked Background Layer)
        if (refImage && refImage.visible && refImage.img) {
            drawCtx.save();
            drawCtx.globalAlpha = refImage.opacity ?? 0.5;
            drawCtx.drawImage(refImage.img, refImage.x || 0, refImage.y || 0, refImage.width, refImage.height);
            drawCtx.restore();
        }

        // Guide Overlay: Vertical Symmetry Line & 8-Head Proportion Ruler
        if (showGuides) {
            drawCtx.save();

            // Proportion Guide Ruler (8 head-height markers for figure drawing)
            const rulerX = 40;
            const rulerTop = 30;
            const rulerBottom = Math.max(rulerTop + 360, canvasH - 40);
            const rulerHeight = rulerBottom - rulerTop;
            const headUnit = rulerHeight / 8;

            const rulerLabels = [
                "1. Cranium / Top",
                "2. Chin / Neck",
                "3. Nipples / Chest",
                "4. Navel / Waist",
                "5. Groin / Pelvis",
                "6. Mid-Thigh",
                "7. Knee Joint",
                "8. Mid-Calf",
                "Soles of Feet"
            ];

            drawCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
            drawCtx.lineWidth = 1 / viewDraw.zoom;
            drawCtx.fillStyle = 'rgba(148, 163, 184, 0.5)';
            drawCtx.font = `${Math.max(9, 10 / viewDraw.zoom)}px JetBrains Mono, monospace`;

            // Vertical spine of ruler
            drawCtx.beginPath();
            drawCtx.moveTo(rulerX, rulerTop);
            drawCtx.lineTo(rulerX, rulerBottom);
            drawCtx.stroke();

            // Horizontal division marks
            for (let i = 0; i <= 8; i++) {
                const markY = rulerTop + i * headUnit;
                drawCtx.beginPath();
                drawCtx.moveTo(rulerX - 6, markY);
                drawCtx.lineTo(rulerX + 18, markY);
                drawCtx.stroke();

                if (i < rulerLabels.length) {
                    drawCtx.fillText(rulerLabels[i], rulerX + 24, markY + 3);
                }
            }
            drawCtx.restore();
        }

        // Symmetry Axis Guide
        if (symmetryMode !== 'off') {
            drawCtx.save();
            drawCtx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
            drawCtx.lineWidth = 1.2 / viewDraw.zoom;
            drawCtx.setLineDash([6 / viewDraw.zoom, 4 / viewDraw.zoom]);

            const axisX = EpiArt.state.symmetryAxis || (canvasW / 2);
            const axisY = EpiArt.state.symmetryAxis || (canvasH / 2);

            if (symmetryMode === 'vertical') {
                drawCtx.beginPath();
                drawCtx.moveTo(axisX, gridMinY);
                drawCtx.lineTo(axisX, gridMaxY);
                drawCtx.stroke();
            } else if (symmetryMode === 'horizontal') {
                drawCtx.beginPath();
                drawCtx.moveTo(gridMinX, axisY);
                drawCtx.lineTo(gridMaxX, axisY);
                drawCtx.stroke();
            }
            drawCtx.restore();
        }

        // Render saved strokes (if visible)
        strokes.forEach(s => {
            if (!s.visible || !s.rawPoints || s.rawPoints.length === 0) return;
            drawCtx.save();
            drawCtx.globalAlpha = s.opacity ?? 1.0;
            drawCtx.strokeStyle = s.color;
            drawCtx.lineWidth = s.brushSize;
            drawCtx.lineJoin = 'round';
            drawCtx.lineCap = 'round';
            drawCtx.beginPath();
            s.rawPoints.forEach((p, i) => i === 0 ? drawCtx.moveTo(p.x, p.y) : drawCtx.lineTo(p.x, p.y));
            drawCtx.stroke();

            if (s.locked) {
                // Subtle lock indicator dot at stroke start
                drawCtx.fillStyle = 'rgba(251, 191, 36, 0.4)';
                drawCtx.beginPath();
                drawCtx.arc(s.rawPoints[0].x, s.rawPoints[0].y, 3 / viewDraw.zoom, 0, 2 * Math.PI);
                drawCtx.fill();
            }
            drawCtx.restore();
        });

        // Render active live stroke
        if (EpiArt.state.drawing && currentTool === 'pen' && currentPoints.length > 0) {
            drawCtx.save();
            drawCtx.strokeStyle = currentColor;
            drawCtx.lineWidth = currentWidth;
            drawCtx.lineJoin = 'round';
            drawCtx.lineCap = 'round';
            drawCtx.beginPath();
            currentPoints.forEach((p, i) => i === 0 ? drawCtx.moveTo(p.x, p.y) : drawCtx.lineTo(p.x, p.y));
            drawCtx.stroke();

            // Render live mirrored stroke if symmetry mode is active
            if (symmetryMode !== 'off') {
                const axisX = EpiArt.state.symmetryAxis || (canvasW / 2);
                const axisY = EpiArt.state.symmetryAxis || (canvasH / 2);

                drawCtx.save();
                drawCtx.strokeStyle = currentColor;
                drawCtx.globalAlpha = 0.8;
                drawCtx.beginPath();
                currentPoints.forEach((p, i) => {
                    const mx = symmetryMode === 'vertical' ? 2 * axisX - p.x : p.x;
                    const my = symmetryMode === 'horizontal' ? 2 * axisY - p.y : p.y;
                    i === 0 ? drawCtx.moveTo(mx, my) : drawCtx.lineTo(mx, my);
                });
                drawCtx.stroke();
                drawCtx.restore();
            }

            drawCtx.restore();
        }

        // Render Eraser Radius Cursor
        if (currentTool === 'eraser' && lastEraserPos) {
            drawCtx.save();
            drawCtx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
            drawCtx.fillStyle = 'rgba(244, 63, 94, 0.15)';
            drawCtx.lineWidth = 1.5 / viewDraw.zoom;
            drawCtx.setLineDash([4 / viewDraw.zoom, 3 / viewDraw.zoom]);
            drawCtx.beginPath();
            drawCtx.arc(lastEraserPos.x, lastEraserPos.y, eraserRadius, 0, 2 * Math.PI);
            drawCtx.fill();
            drawCtx.stroke();
            drawCtx.restore();
        }

        drawCtx.restore();
    }

    // Save snapshot to history stack for full-stroke undo
    function pushHistorySnapshot() {
        const state = EpiArt.state;
        const snapshot = state.strokes.map(s => ({
            id: s.id,
            name: s.name,
            color: s.color,
            brushSize: s.brushSize,
            opacity: s.opacity,
            rawPoints: s.rawPoints ? s.rawPoints.map(p => ({ x: p.x, y: p.y })) : [],
            visible: s.visible,
            locked: s.locked,
            epicyclesOverride: s.epicyclesOverride,
            centroid: s.centroid ? { ...s.centroid } : { x: 0, y: 0 },
            coefficients: s.coefficients ? [...s.coefficients] : [],
            trail: []
        }));
        state.historyStack.push(snapshot);
        if (state.historyStack.length > 30) {
            state.historyStack.shift();
        }
    }

    // Real Point-Range Eraser execution on pointerup
    function applyRealEraser(eraserPath, radius) {
        const state = EpiArt.state;
        if (!eraserPath || eraserPath.length === 0) return;

        let touchedAny = false;
        const newStrokes = [];

        state.strokes.forEach(stroke => {
            // Locked strokes cannot be erased
            if (stroke.locked || !stroke.rawPoints || stroke.rawPoints.length === 0) {
                newStrokes.push(stroke);
                return;
            }

            // Check if any point in stroke is within radius of any point along the eraser path
            const radiusSq = radius * radius;
            const keptSegments = [];
            let currentRun = [];
            let strokeModified = false;

            stroke.rawPoints.forEach(pt => {
                let isErased = false;
                for (let j = 0; j < eraserPath.length; j++) {
                    const ep = eraserPath[j];
                    const dSq = (pt.x - ep.x) ** 2 + (pt.y - ep.y) ** 2;
                    if (dSq <= radiusSq) {
                        isErased = true;
                        break;
                    }
                }

                if (!isErased) {
                    currentRun.push(pt);
                } else {
                    strokeModified = true;
                    if (currentRun.length >= 2) {
                        keptSegments.push(currentRun);
                    }
                    currentRun = [];
                }
            });

            if (currentRun.length >= 2) {
                keptSegments.push(currentRun);
            } else if (currentRun.length === 1 && stroke.rawPoints.length === 1) {
                keptSegments.push(currentRun);
            }

            if (!strokeModified) {
                newStrokes.push(stroke);
                return;
            }

            touchedAny = true;

            // Stroke was erased
            if (keptSegments.length === 0) {
                // Completely removed
                return;
            } else if (keptSegments.length === 1) {
                // Trimmed from end or interior tightened
                stroke.rawPoints = keptSegments[0];
                stroke.trail = [];
                EpiArt.math.computeStrokeDFT(stroke, state.N_RESAMPLE);
                newStrokes.push(stroke);
            } else {
                // Split into 2 or more separate strokes
                keptSegments.forEach((seg, idx) => {
                    const segName = idx === 0 ? stroke.name : `${stroke.name} (${idx + 1})`;
                    const childStroke = {
                        id: 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        name: segName,
                        color: stroke.color,
                        brushSize: stroke.brushSize,
                        opacity: stroke.opacity,
                        rawPoints: seg,
                        visible: stroke.visible,
                        locked: false,
                        epicyclesOverride: stroke.epicyclesOverride,
                        trail: []
                    };
                    EpiArt.math.computeStrokeDFT(childStroke, state.N_RESAMPLE);
                    newStrokes.push(childStroke);
                });
            }
        });

        if (touchedAny) {
            pushHistorySnapshot();
            state.strokes = newStrokes;
            EpiArt.ui.renderLayersList();
            EpiArt.recon.recomputeAllGeometry();
            renderDrawCanvas();
        }
    }

    // Granular Undo Handler
    function handleUndo() {
        const state = EpiArt.state;

        // In-progress stroke undo: remove last 10 points
        if (state.drawing && state.currentTool === 'pen' && state.currentPoints.length > 0) {
            if (state.currentPoints.length > 10) {
                state.currentPoints.splice(state.currentPoints.length - 10, 10);
            } else {
                state.currentPoints = [];
                state.drawing = false;
            }
            renderDrawCanvas();
            return;
        }

        // Finalized stroke undo: restore previous stroke history state
        if (state.historyStack.length > 0) {
            const previousStrokes = state.historyStack.pop();
            state.strokes = previousStrokes.map(s => {
                const copy = {
                    ...s,
                    rawPoints: s.rawPoints ? s.rawPoints.map(p => ({ x: p.x, y: p.y })) : [],
                    trail: []
                };
                EpiArt.math.computeStrokeDFT(copy, state.N_RESAMPLE);
                return copy;
            });
            EpiArt.ui.renderLayersList();
            EpiArt.recon.recomputeAllGeometry();
            renderDrawCanvas();
        }
    }

    // Initialize pointer & keyboard event handlers on drawCv
    function initDrawingEvents() {
        const { drawCv } = EpiArt.state;
        if (!drawCv) return;

        let panLastPos = null;

        // Space key listener for panning
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
                EpiArt.state.spacePressed = true;
                drawCv.style.cursor = 'grab';
                const reconCv = EpiArt.state.reconCv;
                if (reconCv) reconCv.style.cursor = 'grab';
            }
            // Ctrl+Z Undo shortcut
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                EpiArt.state.spacePressed = false;
                EpiArt.state.isPanning = false;
                panLastPos = null;
                drawCv.style.cursor = EpiArt.state.currentTool === 'pen' ? 'crosshair' : 'default';
                const reconCv = EpiArt.state.reconCv;
                if (reconCv) reconCv.style.cursor = 'default';
            }
        });

        // Wheel Zoom on Vector Input Canvas
        drawCv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const view = EpiArt.state.viewDraw;
            const mouseScreen = EpiArt.utils.getScreenPos(drawCv, e);

            const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
            const newZoom = Math.max(0.2, Math.min(12, view.zoom * zoomFactor));

            // Keep pointer stationary in canvas space during zoom
            view.panX = mouseScreen.x - (mouseScreen.x - view.panX) * (newZoom / view.zoom);
            view.panY = mouseScreen.y - (mouseScreen.y - view.panY) * (newZoom / view.zoom);
            view.zoom = newZoom;

            if (EpiArt.state.syncViews) {
                EpiArt.state.viewRecon.zoom = view.zoom;
                EpiArt.state.viewRecon.panX = view.panX;
                EpiArt.state.viewRecon.panY = view.panY;
            }

            renderDrawCanvas();
        }, { passive: false });

        // Pointer Down
        drawCv.addEventListener('pointerdown', (e) => {
            // Check if space-panning or middle-click panning
            if (EpiArt.state.spacePressed || e.button === 1) {
                EpiArt.state.isPanning = true;
                EpiArt.state.panCanvas = 'draw';
                panLastPos = { x: e.clientX, y: e.clientY };
                drawCv.style.cursor = 'grabbing';
                drawCv.setPointerCapture(e.pointerId);
                return;
            }

            if (e.button !== 0) return; // Only primary left click for drawing/erasing

            EpiArt.state.drawing = true;
            drawCv.setPointerCapture(e.pointerId);

            const canvasPos = EpiArt.utils.getPos(drawCv, e, EpiArt.state.viewDraw);

            if (EpiArt.state.currentTool === 'eraser') {
                lastEraserPos = canvasPos;
                activeEraserPath = [canvasPos];
                renderDrawCanvas();
            } else {
                EpiArt.state.currentPoints = [canvasPos];
                EpiArt.state.inStrokeHistory = [[canvasPos]];
                renderDrawCanvas();
            }
        });

        // Pointer Move
        drawCv.addEventListener('pointermove', (e) => {
            if (EpiArt.state.isPanning && panLastPos) {
                const dx = e.clientX - panLastPos.x;
                const dy = e.clientY - panLastPos.y;
                panLastPos = { x: e.clientX, y: e.clientY };

                EpiArt.state.viewDraw.panX += dx;
                EpiArt.state.viewDraw.panY += dy;

                if (EpiArt.state.syncViews) {
                    EpiArt.state.viewRecon.panX = EpiArt.state.viewDraw.panX;
                    EpiArt.state.viewRecon.panY = EpiArt.state.viewDraw.panY;
                }

                renderDrawCanvas();
                return;
            }

            const canvasPos = EpiArt.utils.getPos(drawCv, e, EpiArt.state.viewDraw);

            if (EpiArt.state.currentTool === 'eraser') {
                lastEraserPos = canvasPos;
                if (EpiArt.state.drawing) {
                    activeEraserPath.push(canvasPos);
                }
                renderDrawCanvas();
                return;
            }

            if (!EpiArt.state.drawing) return;

            EpiArt.state.currentPoints.push(canvasPos);

            // In-stroke history checkpointing
            if (EpiArt.state.currentPoints.length % 10 === 0) {
                EpiArt.state.inStrokeHistory.push([...EpiArt.state.currentPoints]);
            }

            renderDrawCanvas();
        });

        // Pointer Leave
        drawCv.addEventListener('pointerleave', () => {
            if (EpiArt.state.currentTool === 'eraser') {
                lastEraserPos = null;
                renderDrawCanvas();
            }
        });

        // Pointer Up
        drawCv.addEventListener('pointerup', (e) => {
            if (EpiArt.state.isPanning) {
                EpiArt.state.isPanning = false;
                panLastPos = null;
                drawCv.style.cursor = EpiArt.state.spacePressed ? 'grab' : (EpiArt.state.currentTool === 'pen' ? 'crosshair' : 'default');
                return;
            }

            if (!EpiArt.state.drawing) return;
            EpiArt.state.drawing = false;

            if (EpiArt.state.currentTool === 'eraser') {
                applyRealEraser(activeEraserPath, EpiArt.state.eraserRadius);
                activeEraserPath = [];
                renderDrawCanvas();
                return;
            }

            // Pen Tool: Finalize Stroke
            if (EpiArt.state.currentTool === 'pen') {
                if (EpiArt.state.currentPoints.length > 2) {
                    pushHistorySnapshot();

                    let finalPoints = EpiArt.state.currentPoints;

                    // 1. Snap-to-close check
                    if (EpiArt.state.snapToClose) {
                        finalPoints = EpiArt.utils.checkSnapClose(finalPoints, EpiArt.state.snapRadius);
                    }

                    // 2. Stroke smoothing on completion
                    if (EpiArt.state.smoothing > 0) {
                        finalPoints = EpiArt.utils.smoothStroke(finalPoints, EpiArt.state.smoothing);
                    }

                    const strokeId = 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                    const strokeName = `Stroke ${EpiArt.state.strokes.length + 1}`;

                    const stroke = {
                        id: strokeId,
                        name: strokeName,
                        color: EpiArt.state.currentColor,
                        brushSize: EpiArt.state.currentWidth,
                        opacity: 1.0,
                        rawPoints: finalPoints,
                        visible: true,
                        locked: false,
                        epicyclesOverride: null,
                        trail: []
                    };

                    EpiArt.math.computeStrokeDFT(stroke, EpiArt.state.N_RESAMPLE);
                    EpiArt.state.strokes.push(stroke);

                    // 3. Symmetry / Mirror Mode: create independent mirrored stroke
                    if (EpiArt.state.symmetryMode !== 'off') {
                        const canvasW = drawCv.width / EpiArt.state.dpr;
                        const canvasH = drawCv.height / EpiArt.state.dpr;
                        const axisX = EpiArt.state.symmetryAxis || (canvasW / 2);
                        const axisY = EpiArt.state.symmetryAxis || (canvasH / 2);

                        const mirroredPoints = finalPoints.map(p => ({
                            x: EpiArt.state.symmetryMode === 'vertical' ? 2 * axisX - p.x : p.x,
                            y: EpiArt.state.symmetryMode === 'horizontal' ? 2 * axisY - p.y : p.y
                        }));

                        const mirrorStroke = {
                            id: 'stroke_mirrored_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                            name: `${strokeName} (Mirrored)`,
                            color: EpiArt.state.currentColor,
                            brushSize: EpiArt.state.currentWidth,
                            opacity: 1.0,
                            rawPoints: mirroredPoints,
                            visible: true,
                            locked: false,
                            epicyclesOverride: null,
                            trail: []
                        };

                        EpiArt.math.computeStrokeDFT(mirrorStroke, EpiArt.state.N_RESAMPLE);
                        EpiArt.state.strokes.push(mirrorStroke);
                    }

                    EpiArt.ui.renderLayersList();
                    EpiArt.recon.recomputeAllGeometry();
                }

                EpiArt.state.currentPoints = [];
                EpiArt.state.inStrokeHistory = [];
                renderDrawCanvas();
            }
        });
    }

    EpiArt.drawing = {
        renderDrawCanvas,
        initDrawingEvents,
        pushHistorySnapshot,
        handleUndo,
        applyRealEraser
    };
})();
