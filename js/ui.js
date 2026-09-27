// EpiArt — User Interface & Storage Module (Studio v3)
window.EpiArt = window.EpiArt || {};

(function () {
    // Render Stroke Layers List UI with Drag Reordering, Lock, Inline Rename, Recolor & Duplicate
    function renderLayersList() {
        const state = EpiArt.state;
        const container = document.getElementById('layersList');
        if (!container) return;

        container.innerHTML = '';
        const layerCountVal = document.getElementById('layerCountVal');
        if (layerCountVal) {
            layerCountVal.textContent = `${state.strokes.length} layer${state.strokes.length === 1 ? '' : 's'}`;
        }

        if (state.strokes.length === 0) {
            container.innerHTML = `<div style="font-size:0.75rem; color:var(--text-dim); text-align:center; padding:12px;">No strokes drawn yet</div>`;
            return;
        }

        state.strokes.forEach((s, idx) => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.draggable = true;
            item.dataset.index = idx;
            if (s.locked) item.classList.add('locked');

            // Drag-and-drop Reordering (controls canvas z-index!)
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', idx);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (!isNaN(fromIdx) && fromIdx !== idx) {
                    const [moved] = state.strokes.splice(fromIdx, 1);
                    state.strokes.splice(idx, 0, moved);
                    EpiArt.drawing.renderDrawCanvas();
                    renderLayersList();
                    EpiArt.recon.recomputeAllGeometry();
                }
            });

            // Drag handle grip indicator
            const dragHandle = document.createElement('span');
            dragHandle.className = 'layer-drag-handle';
            dragHandle.innerHTML = '⋮⋮';
            dragHandle.title = 'Drag to reorder z-index';

            // Recolor Swatch & Native Color Input
            const swatch = document.createElement('label');
            swatch.className = 'layer-swatch';
            swatch.style.background = s.color;
            swatch.title = 'Click to recolor stroke';

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = s.color;
            colorInput.style.display = 'none';
            colorInput.addEventListener('input', (e) => {
                s.color = e.target.value;
                swatch.style.background = s.color;
                EpiArt.drawing.renderDrawCanvas();
                EpiArt.recon.recomputeAllGeometry();
            });
            swatch.appendChild(colorInput);

            // Inline Editable Title
            const title = document.createElement('div');
            title.className = 'layer-title';
            title.textContent = s.name || `Stroke ${idx + 1}`;
            title.title = 'Double-click to rename';

            title.addEventListener('dblclick', () => {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'layer-name-input';
                input.value = s.name || `Stroke ${idx + 1}`;
                title.replaceWith(input);
                input.focus();
                input.select();

                const commitName = () => {
                    s.name = input.value.trim() || `Stroke ${idx + 1}`;
                    title.textContent = s.name;
                    input.replaceWith(title);
                    updateOutput();
                };

                input.addEventListener('blur', commitName);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') commitName();
                    if (ev.key === 'Escape') input.replaceWith(title);
                });
            });

            // Mini N override input
            const nInput = document.createElement('input');
            nInput.type = 'number';
            nInput.className = 'layer-n-input';
            nInput.placeholder = state.maxTerms;
            nInput.value = s.epicyclesOverride !== null ? s.epicyclesOverride : '';
            nInput.title = 'Per-stroke epicycles N override (leave blank to use global N)';
            nInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                s.epicyclesOverride = (isNaN(val) || val <= 0) ? null : Math.min(val, s.coefficients ? s.coefficients.length : state.maxTerms);
                s.trail = [];
                EpiArt.recon.updateBudgetReadout();
                updateOutput();
            });

            // Lock Toggle Button
            const lockBtn = document.createElement('button');
            lockBtn.className = 'layer-btn';
            lockBtn.textContent = s.locked ? '🔒' : '🔓';
            lockBtn.title = s.locked ? 'Unlock stroke (allow editing/erasing)' : 'Lock stroke (protect from editing/erasing)';
            lockBtn.addEventListener('click', () => {
                s.locked = !s.locked;
                lockBtn.textContent = s.locked ? '🔒' : '🔓';
                item.classList.toggle('locked', s.locked);
                EpiArt.drawing.renderDrawCanvas();
            });

            // Visibility Toggle Button
            const visBtn = document.createElement('button');
            visBtn.className = 'layer-btn';
            visBtn.textContent = s.visible ? '👁' : '🙈';
            visBtn.title = 'Toggle Layer Visibility';
            visBtn.addEventListener('click', () => {
                s.visible = !s.visible;
                visBtn.textContent = s.visible ? '👁' : '🙈';
                EpiArt.drawing.renderDrawCanvas();
                EpiArt.recon.recomputeAllGeometry();
            });

            // Duplicate Stroke Button
            const dupBtn = document.createElement('button');
            dupBtn.className = 'layer-btn';
            dupBtn.textContent = '⧉';
            dupBtn.title = 'Duplicate stroke (with offset or symmetry mirror)';
            dupBtn.addEventListener('click', () => {
                EpiArt.drawing.pushHistorySnapshot();
                const offset = 20;
                let newRawPoints = [];

                if (state.symmetryMode === 'vertical') {
                    const canvasW = state.drawCv.width / state.dpr;
                    const axisX = state.symmetryAxis || (canvasW / 2);
                    newRawPoints = s.rawPoints.map(p => ({ x: 2 * axisX - p.x, y: p.y }));
                } else if (state.symmetryMode === 'horizontal') {
                    const canvasH = state.drawCv.height / state.dpr;
                    const axisY = state.symmetryAxis || (canvasH / 2);
                    newRawPoints = s.rawPoints.map(p => ({ x: p.x, y: 2 * axisY - p.y }));
                } else {
                    newRawPoints = s.rawPoints.map(p => ({ x: p.x + offset, y: p.y + offset }));
                }

                const clone = {
                    id: 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    name: `${s.name || 'Stroke'} Copy`,
                    color: s.color,
                    brushSize: s.brushSize,
                    opacity: s.opacity ?? 1.0,
                    rawPoints: newRawPoints,
                    visible: true,
                    locked: false,
                    epicyclesOverride: s.epicyclesOverride,
                    trail: []
                };

                EpiArt.math.computeStrokeDFT(clone, state.N_RESAMPLE);
                state.strokes.splice(idx + 1, 0, clone);
                EpiArt.drawing.renderDrawCanvas();
                renderLayersList();
                EpiArt.recon.recomputeAllGeometry();
            });

            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.className = 'layer-btn btn-danger';
            delBtn.textContent = '✕';
            delBtn.title = 'Delete Stroke';
            delBtn.addEventListener('click', () => {
                EpiArt.drawing.pushHistorySnapshot();
                state.strokes.splice(idx, 1);
                EpiArt.drawing.renderDrawCanvas();
                renderLayersList();
                EpiArt.recon.recomputeAllGeometry();
            });

            item.appendChild(dragHandle);
            item.appendChild(swatch);
            item.appendChild(title);
            item.appendChild(nInput);
            item.appendChild(lockBtn);
            item.appendChild(visBtn);
            item.appendChild(dupBtn);
            item.appendChild(delBtn);
            container.appendChild(item);
        });
    }

    // Re-resample all strokes with current N_RESAMPLE
    function reResampleAll() {
        const state = EpiArt.state;
        state.strokes.forEach(s => EpiArt.math.computeStrokeDFT(s, state.N_RESAMPLE));
        EpiArt.recon.recomputeAllGeometry();
        renderLayersList();
    }

    // Apply Presets (Parametric Shapes + Humanoid Skeleton Scaffold)
    function applyPreset(name) {
        const state = EpiArt.state;
        const r = state.drawCv.getBoundingClientRect();
        const cx = r.width / 2;
        const cy = r.height / 2;
        const size = Math.min(r.width, r.height) * 0.35;

        EpiArt.drawing.pushHistorySnapshot();

        if (name === 'humanoid') {
            // Humanoid Skeleton Scaffold: 6 independently editable named strokes
            const headR = size * 0.22;
            const headCenterY = cy - size * 0.85;

            // 1. Head circle loop
            const headPts = [];
            for (let i = 0; i <= 36; i++) {
                const theta = (i / 36) * 2 * Math.PI;
                headPts.push({
                    x: cx + headR * Math.cos(theta),
                    y: headCenterY + headR * Math.sin(theta)
                });
            }

            // 2. Torso spine
            const torsoPts = [];
            const neckY = headCenterY + headR;
            const pelvisY = cy - size * 0.05;
            for (let i = 0; i <= 20; i++) {
                torsoPts.push({ x: cx, y: neckY + (i / 20) * (pelvisY - neckY) });
            }

            // 3. Left Arm
            const leftArmPts = [];
            const shoulderY = neckY + (pelvisY - neckY) * 0.2;
            const leftShoulder = { x: cx - size * 0.05, y: shoulderY };
            const leftElbow = { x: cx - size * 0.35, y: shoulderY + size * 0.2 };
            const leftHand = { x: cx - size * 0.42, y: shoulderY + size * 0.45 };
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                leftArmPts.push({ x: leftShoulder.x + (leftElbow.x - leftShoulder.x) * t, y: leftShoulder.y + (leftElbow.y - leftShoulder.y) * t });
            }
            for (let i = 1; i <= 10; i++) {
                const t = i / 10;
                leftArmPts.push({ x: leftElbow.x + (leftHand.x - leftElbow.x) * t, y: leftElbow.y + (leftHand.y - leftElbow.y) * t });
            }

            // 4. Right Arm
            const rightArmPts = [];
            const rightShoulder = { x: cx + size * 0.05, y: shoulderY };
            const rightElbow = { x: cx + size * 0.35, y: shoulderY + size * 0.2 };
            const rightHand = { x: cx + size * 0.42, y: shoulderY + size * 0.45 };
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                rightArmPts.push({ x: rightShoulder.x + (rightElbow.x - rightShoulder.x) * t, y: rightShoulder.y + (rightElbow.y - rightShoulder.y) * t });
            }
            for (let i = 1; i <= 10; i++) {
                const t = i / 10;
                rightArmPts.push({ x: rightElbow.x + (rightHand.x - rightElbow.x) * t, y: rightElbow.y + (rightHand.y - rightElbow.y) * t });
            }

            // 5. Left Leg
            const leftLegPts = [];
            const leftHip = { x: cx - size * 0.12, y: pelvisY };
            const leftKnee = { x: cx - size * 0.18, y: pelvisY + size * 0.5 };
            const leftFoot = { x: cx - size * 0.22, y: pelvisY + size * 0.95 };
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                leftLegPts.push({ x: leftHip.x + (leftKnee.x - leftHip.x) * t, y: leftHip.y + (leftKnee.y - leftHip.y) * t });
            }
            for (let i = 1; i <= 10; i++) {
                const t = i / 10;
                leftLegPts.push({ x: leftKnee.x + (leftFoot.x - leftKnee.x) * t, y: leftKnee.y + (leftFoot.y - leftKnee.y) * t });
            }

            // 6. Right Leg
            const rightLegPts = [];
            const rightHip = { x: cx + size * 0.12, y: pelvisY };
            const rightKnee = { x: cx + size * 0.18, y: pelvisY + size * 0.5 };
            const rightFoot = { x: cx + size * 0.22, y: pelvisY + size * 0.95 };
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                rightLegPts.push({ x: rightHip.x + (rightKnee.x - rightHip.x) * t, y: rightHip.y + (rightKnee.y - rightHip.y) * t });
            }
            for (let i = 1; i <= 10; i++) {
                const t = i / 10;
                rightLegPts.push({ x: rightKnee.x + (rightFoot.x - rightKnee.x) * t, y: rightKnee.y + (rightFoot.y - rightKnee.y) * t });
            }

            const skeletonDefs = [
                { name: 'Head', color: '#f1f5f9', pts: headPts },
                { name: 'Torso', color: '#38bdf8', pts: torsoPts },
                { name: 'Left Arm', color: '#34d399', pts: leftArmPts },
                { name: 'Right Arm', color: '#fbbf24', pts: rightArmPts },
                { name: 'Left Leg', color: '#c084fc', pts: leftLegPts },
                { name: 'Right Leg', color: '#f43f5e', pts: rightLegPts }
            ];

            state.strokes = skeletonDefs.map((def, i) => {
                const s = {
                    id: `skeleton_${def.name.toLowerCase().replace(' ', '_')}_${Date.now()}_${i}`,
                    name: def.name,
                    color: def.color,
                    brushSize: 3,
                    opacity: 1.0,
                    rawPoints: def.pts,
                    visible: true,
                    locked: false,
                    epicyclesOverride: null,
                    trail: []
                };
                EpiArt.math.computeStrokeDFT(s, state.N_RESAMPLE);
                return s;
            });
        } else {
            // Math Demo Shapes (Heart, Star, Infinity, Circle)
            const pts = [];
            const count = 200;

            for (let i = 0; i <= count; i++) {
                const theta = (i / count) * 2 * Math.PI;
                let x = 0, y = 0;

                if (name === 'heart') {
                    x = 16 * Math.sin(theta) ** 3;
                    y = -(13 * Math.cos(theta) - 5 * Math.cos(2 * theta) - 2 * Math.cos(3 * theta) - Math.cos(4 * theta));
                    x = cx + (x / 18) * size;
                    y = cy + (y / 18) * size;
                } else if (name === 'star') {
                    const rOffset = i % 20 < 10 ? size : size * 0.45;
                    x = cx + rOffset * Math.cos(theta);
                    y = cy + rOffset * Math.sin(theta);
                } else if (name === 'infinity') {
                    const scale = size * 1.2;
                    const denom = 1 + Math.sin(theta) ** 2;
                    x = cx + (scale * Math.cos(theta)) / denom;
                    y = cy + (scale * Math.sin(theta) * Math.cos(theta)) / denom;
                } else if (name === 'circle') {
                    x = cx + size * Math.cos(theta);
                    y = cy + size * Math.sin(theta);
                }
                pts.push({ x, y });
            }

            const stroke = {
                id: 'preset_' + name + '_' + Date.now(),
                name: name.charAt(0).toUpperCase() + name.slice(1),
                color: state.currentColor,
                brushSize: state.currentWidth,
                opacity: 1.0,
                rawPoints: pts,
                visible: true,
                locked: false,
                epicyclesOverride: null,
                trail: []
            };
            EpiArt.math.computeStrokeDFT(stroke, state.N_RESAMPLE);
            state.strokes = [stroke];
        }

        EpiArt.drawing.renderDrawCanvas();
        renderLayersList();
        EpiArt.recon.recomputeAllGeometry();
    }

    // Update Parameters JSON output text preview
    function updateOutput() {
        const state = EpiArt.state;
        const outputEl = document.getElementById('output');
        if (!outputEl) return;

        if (!state.hasContent) {
            outputEl.textContent = "No active strokes";
            return;
        }

        const visibleStrokes = state.strokes.filter(s => s.visible);
        const payload = {
            format: "EPI",
            version: 1,
            meta: {
                resamplePoints: state.N_RESAMPLE,
                strokeCount: visibleStrokes.length,
                globalEpicycles: state.maxTerms
            },
            strokes: visibleStrokes.map((s, i) => {
                const nUsed = s.epicyclesOverride !== null ? s.epicyclesOverride : state.maxTerms;
                return {
                    id: s.id || `stroke_${i + 1}`,
                    name: s.name || `Stroke ${i + 1}`,
                    color: s.color,
                    brushSize: s.brushSize,
                    opacity: s.opacity ?? 1.0,
                    locked: !!s.locked,
                    centroid: {
                        x: EpiArt.utils.round(s.centroid.x, 1),
                        y: EpiArt.utils.round(s.centroid.y, 1)
                    },
                    epicyclesUsed: Math.min(nUsed, s.coefficients ? s.coefficients.length : 0),
                    coefficients: (s.coefficients || []).slice(0, Math.min(nUsed, s.coefficients ? s.coefficients.length : 0)).map(c => ({
                        freq: c.freq,
                        amp: EpiArt.utils.round(c.amp, 2),
                        phase: EpiArt.utils.round(c.phase, 3)
                    }))
                };
            })
        };

        outputEl.textContent = JSON.stringify(payload, null, 2);
    }

    // Render compression modal preview thumbnail
    function renderModalPreview() {
        const state = EpiArt.state;
        const previewCv = document.getElementById('modalPreviewCv');
        if (!previewCv) return;

        const ctx = previewCv.getContext('2d');
        const w = previewCv.width;
        const h = previewCv.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, w, h);

        const grade = state.compressionModal.grade;
        const customPct = state.compressionModal.customPercent;
        const format = state.compressionModal.format;

        const metrics = EpiArt.math.calculateCompressionMetrics(state.strokes, grade, customPct, format);

        // Update modal metrics display
        const metricTerms = document.getElementById('modalMetricTerms');
        if (metricTerms) metricTerms.textContent = `${metrics.totalTerms} terms (${metrics.percentRetained}%)`;

        const metricSize = document.getElementById('modalMetricSize');
        if (metricSize) metricSize.textContent = `~${metrics.estimatedKB} KB`;

        const visibleStrokes = state.strokes.filter(s => s.visible && s.coefficients && s.coefficients.length > 0);
        if (visibleStrokes.length === 0) return;

        // Draw preview curves
        ctx.save();
        ctx.translate(w / 2, h / 2);

        // Calculate preview scale factor
        const maxR = Math.max(10, Math.hypot(
            Math.max(...visibleStrokes.map(s => Math.abs(s.centroid.x - state.globalCentroid.x) + 50)),
            Math.max(...visibleStrokes.map(s => Math.abs(s.centroid.y - state.globalCentroid.y) + 50))
        ));
        const previewScale = (Math.min(w, h) * 0.38) / maxR;
        ctx.scale(previewScale, previewScale);

        visibleStrokes.forEach(s => {
            const truncated = EpiArt.math.truncateCoefficients(s.coefficients, metrics.ratio);
            if (truncated.length === 0) return;

            const rootX = s.centroid.x - state.globalCentroid.x;
            const rootY = s.centroid.y - state.globalCentroid.y;

            ctx.save();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = Math.max(1.2, s.brushSize) / previewScale;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();

            const M = 150;
            for (let n = 0; n <= M; n++) {
                const tt = (2 * Math.PI * n) / M;
                let px = rootX;
                let py = rootY;
                for (let k = 0; k < truncated.length; k++) {
                    const c = truncated[k];
                    const ang = c.freq * tt + c.phase;
                    px += c.amp * Math.cos(ang);
                    py += c.amp * Math.sin(ang);
                }
                n === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.restore();
        });

        ctx.restore();
    }

    // Open Export Compression Modal
    function openCompressionModal(defaultGrade = 'lossless') {
        const state = EpiArt.state;
        const modal = document.getElementById('compressionModal');
        if (!modal) return;

        state.compressionModal.isOpen = true;
        state.compressionModal.grade = defaultGrade;

        const gradeRadio = document.querySelector(`input[name="compGrade"][value="${defaultGrade}"]`);
        if (gradeRadio) gradeRadio.checked = true;

        const customGroup = document.getElementById('customGradeGroup');
        if (customGroup) customGroup.style.display = defaultGrade === 'custom' ? 'flex' : 'none';

        modal.style.display = 'flex';
        renderModalPreview();
    }

    // Close Export Compression Modal
    function closeCompressionModal() {
        const state = EpiArt.state;
        const modal = document.getElementById('compressionModal');
        if (!modal) return;
        state.compressionModal.isOpen = false;
        modal.style.display = 'none';
    }

    // Execute Export Download from Modal
    function executeModalDownload() {
        const state = EpiArt.state;
        const grade = state.compressionModal.grade;
        const customPct = state.compressionModal.customPercent;
        const format = state.compressionModal.format;

        const metrics = EpiArt.math.calculateCompressionMetrics(state.strokes, grade, customPct, format);
        const jsonStr = JSON.stringify(metrics.payload, null, 2);

        const blob = new Blob([jsonStr], { type: format === 'epi' ? 'application/vnd.epiart+json' : 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'epi' ? 'epi' : 'json';
        a.download = `epiart_${grade}_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        closeCompressionModal();
    }

    // Apply relative height ratio for stacked mode
    function applyStackedRatio(ratio) {
        const state = EpiArt.state;
        state.stackedRatio = ratio;
        const stage = document.getElementById('stageContainer');
        if (stage) {
            stage.style.setProperty('--stacked-top-ratio', `${(ratio * 100).toFixed(1)}%`);
            stage.style.setProperty('--stacked-bottom-ratio', `${((1 - ratio) * 100).toFixed(1)}%`);
        }
        try {
            localStorage.setItem('epiart_stacked_ratio', ratio.toString());
        } catch (e) {}
    }

    // Switch layout mode (side-by-side vs stacked)
    function setLayoutMode(mode) {
        const state = EpiArt.state;
        state.layoutMode = mode;
        const workspace = document.getElementById('workspaceEl');
        const btnSide = document.getElementById('layoutSideBySideBtn');
        const btnStacked = document.getElementById('layoutStackedBtn');

        if (mode === 'stacked') {
            if (workspace) {
                workspace.classList.add('layout-stacked');
                workspace.classList.remove('layout-side-by-side');
            }
            if (btnStacked) btnStacked.classList.add('active');
            if (btnSide) btnSide.classList.remove('active');
            applyStackedRatio(state.stackedRatio);
        } else {
            if (workspace) {
                workspace.classList.remove('layout-stacked');
                workspace.classList.add('layout-side-by-side');
            }
            if (btnSide) btnSide.classList.add('active');
            if (btnStacked) btnStacked.classList.remove('active');
        }

        try {
            localStorage.setItem('epiart_layout_mode', mode);
        } catch (e) {}

        if (EpiArt.resizeAll) {
            setTimeout(EpiArt.resizeAll, 10);
        }
    }

    // Main Studio UI Initialization
    function setupUI() {
        const state = EpiArt.state;

        // Tool Mode Buttons
        const toolPen = document.getElementById('toolPen');
        const toolEraser = document.getElementById('toolEraser');
        const brushLabel = document.getElementById('brushLabel');
        const brushVal = document.getElementById('brushSizeVal');
        const brushSlider = document.getElementById('brushSize');

        if (toolPen && toolEraser) {
            toolPen.addEventListener('click', () => {
                state.currentTool = 'pen';
                toolPen.classList.add('active');
                toolEraser.classList.remove('active');
                if (brushLabel) brushLabel.textContent = 'Brush Size';
                if (brushSlider) {
                    brushSlider.min = '1';
                    brushSlider.max = '15';
                    brushSlider.value = state.currentWidth;
                }
                if (brushVal) brushVal.textContent = `${state.currentWidth}px`;
                state.drawCv.style.cursor = 'crosshair';
                EpiArt.drawing.renderDrawCanvas();
            });

            toolEraser.addEventListener('click', () => {
                state.currentTool = 'eraser';
                toolEraser.classList.add('active');
                toolPen.classList.remove('active');
                if (brushLabel) brushLabel.textContent = 'Eraser Radius';
                if (brushSlider) {
                    brushSlider.min = '5';
                    brushSlider.max = '60';
                    brushSlider.value = state.eraserRadius;
                }
                if (brushVal) brushVal.textContent = `${state.eraserRadius}px`;
                state.drawCv.style.cursor = 'default';
                EpiArt.drawing.renderDrawCanvas();
            });
        }

        // Color Swatches
        const colorDots = document.querySelectorAll('.color-dot');
        colorDots.forEach(dot => {
            dot.addEventListener('click', () => {
                colorDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                state.currentColor = dot.dataset.color;
            });
        });

        // Brush / Eraser Size Slider
        if (brushSlider && brushVal) {
            brushSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (state.currentTool === 'pen') {
                    state.currentWidth = val;
                    brushVal.textContent = `${val}px`;
                } else {
                    state.eraserRadius = val;
                    brushVal.textContent = `${val}px`;
                }
                EpiArt.drawing.renderDrawCanvas();
            });
        }

        // Smoothing Slider
        const smoothSlider = document.getElementById('smoothSlider');
        const smoothVal = document.getElementById('smoothVal');
        if (smoothSlider && smoothVal) {
            smoothSlider.addEventListener('input', (e) => {
                state.smoothing = parseInt(e.target.value, 10);
                smoothVal.textContent = `${state.smoothing}%`;
            });
        }

        // Snap-to-close Toggle Button
        const snapToggle = document.getElementById('snapToggle');
        if (snapToggle) {
            snapToggle.addEventListener('click', () => {
                state.snapToClose = !state.snapToClose;
                snapToggle.classList.toggle('active', state.snapToClose);
                snapToggle.textContent = state.snapToClose ? '🧲 Snap-Close: ON' : '🧲 Snap-Close: OFF';
            });
        }

        // Guide Overlay Toggle Button
        const guidesBtn = document.getElementById('guidesBtn');
        if (guidesBtn) {
            guidesBtn.addEventListener('click', () => {
                state.showGuides = !state.showGuides;
                guidesBtn.classList.toggle('active', state.showGuides);
                guidesBtn.textContent = state.showGuides ? '📏 Guides: ON' : '📏 Guides: OFF';
                EpiArt.drawing.renderDrawCanvas();
            });
        }

        // Symmetry Mode Toggle Button (Off -> Vertical -> Horizontal -> Off)
        const symmetryBtn = document.getElementById('symmetryBtn');
        if (symmetryBtn) {
            symmetryBtn.addEventListener('click', () => {
                if (state.symmetryMode === 'off') {
                    state.symmetryMode = 'vertical';
                    symmetryBtn.textContent = '🪞 Symmetry: Vert';
                    symmetryBtn.classList.add('active');
                } else if (state.symmetryMode === 'vertical') {
                    state.symmetryMode = 'horizontal';
                    symmetryBtn.textContent = '🪞 Symmetry: Horiz';
                    symmetryBtn.classList.add('active');
                } else {
                    state.symmetryMode = 'off';
                    symmetryBtn.textContent = '🪞 Symmetry: OFF';
                    symmetryBtn.classList.remove('active');
                }
                EpiArt.drawing.renderDrawCanvas();
            });
        }

        // Reference Image Import & Opacity
        const refImageInput = document.getElementById('refImageInput');
        const refOpacitySlider = document.getElementById('refOpacitySlider');
        const refOpacityVal = document.getElementById('refOpacityVal');
        const refToggleBtn = document.getElementById('refToggleBtn');

        if (refImageInput) {
            refImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        const r = state.drawCv.getBoundingClientRect();
                        const maxW = r.width * 0.8;
                        const maxH = r.height * 0.8;
                        const scale = Math.min(maxW / img.width, maxH / img.height, 1);

                        state.refImage = {
                            img,
                            width: img.width * scale,
                            height: img.height * scale,
                            x: (r.width - img.width * scale) / 2,
                            y: (r.height - img.height * scale) / 2,
                            opacity: 0.5,
                            visible: true
                        };
                        if (refOpacitySlider) refOpacitySlider.value = 50;
                        if (refOpacityVal) refOpacityVal.textContent = '50%';
                        if (refToggleBtn) refToggleBtn.style.display = 'inline-flex';
                        EpiArt.drawing.renderDrawCanvas();
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        // Allow drag-and-drop of reference image directly onto draw canvas
        if (state.drawCv) {
            state.drawCv.addEventListener('dragover', (e) => e.preventDefault());
            state.drawCv.addEventListener('drop', (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                            const r = state.drawCv.getBoundingClientRect();
                            const maxW = r.width * 0.8;
                            const maxH = r.height * 0.8;
                            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
                            state.refImage = {
                                img,
                                width: img.width * scale,
                                height: img.height * scale,
                                x: (r.width - img.width * scale) / 2,
                                y: (r.height - img.height * scale) / 2,
                                opacity: 0.5,
                                visible: true
                            };
                            EpiArt.drawing.renderDrawCanvas();
                        };
                        img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (refOpacitySlider && refOpacityVal) {
            refOpacitySlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                refOpacityVal.textContent = `${val}%`;
                if (state.refImage) {
                    state.refImage.opacity = val / 100;
                    EpiArt.drawing.renderDrawCanvas();
                }
            });
        }

        if (refToggleBtn) {
            refToggleBtn.addEventListener('click', () => {
                if (state.refImage) {
                    state.refImage.visible = !state.refImage.visible;
                    refToggleBtn.textContent = state.refImage.visible ? '👁 Ref: ON' : '🙈 Ref: OFF';
                    EpiArt.drawing.renderDrawCanvas();
                }
            });
        }

        // Viewport Reset Buttons
        const resetDrawViewBtn = document.getElementById('resetDrawViewBtn');
        if (resetDrawViewBtn) {
            resetDrawViewBtn.addEventListener('click', () => {
                state.viewDraw = { zoom: 1, panX: 0, panY: 0 };
                if (state.syncViews) {
                    state.viewRecon = { zoom: 1, panX: 0, panY: 0 };
                }
                EpiArt.drawing.renderDrawCanvas();
            });
        }

        const resetReconViewBtn = document.getElementById('resetReconViewBtn');
        if (resetReconViewBtn) {
            resetReconViewBtn.addEventListener('click', () => {
                state.viewRecon = { zoom: 1, panX: 0, panY: 0 };
                if (state.syncViews) {
                    state.viewDraw = { zoom: 1, panX: 0, panY: 0 };
                    EpiArt.drawing.renderDrawCanvas();
                }
            });
        }

        // Undo & Clear Buttons
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                EpiArt.drawing.handleUndo();
            });
        }

        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                EpiArt.drawing.pushHistorySnapshot();
                state.strokes = [];
                state.currentPoints = [];
                EpiArt.drawing.renderDrawCanvas();
                renderLayersList();
                EpiArt.recon.recomputeAllGeometry();
            });
        }

        // Merge Visible Strokes
        const mergeBtn = document.getElementById('mergeBtn');
        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => {
                const visible = state.strokes.filter(s => s.visible && s.rawPoints && s.rawPoints.length > 0);
                if (visible.length < 2) return;

                EpiArt.drawing.pushHistorySnapshot();
                const mergedPoints = [];
                visible.forEach(s => mergedPoints.push(...s.rawPoints));

                const mergedStroke = {
                    id: 'stroke_merged_' + Date.now(),
                    name: 'Merged Path',
                    color: visible[0].color,
                    brushSize: visible[0].brushSize,
                    opacity: 1.0,
                    rawPoints: mergedPoints,
                    visible: true,
                    locked: false,
                    epicyclesOverride: null,
                    trail: []
                };

                EpiArt.math.computeStrokeDFT(mergedStroke, state.N_RESAMPLE);
                state.strokes = [mergedStroke];
                EpiArt.drawing.renderDrawCanvas();
                renderLayersList();
                EpiArt.recon.recomputeAllGeometry();
            });
        }

        // Presets Buttons
        const pHeart = document.getElementById('presetHeart');
        const pStar = document.getElementById('presetStar');
        const pInfinity = document.getElementById('presetInfinity');
        const pCircle = document.getElementById('presetCircle');
        const pHumanoid = document.getElementById('presetHumanoid');
        const resetAllBtn = document.getElementById('resetAllBtn');

        if (pHeart) pHeart.addEventListener('click', () => applyPreset('heart'));
        if (pStar) pStar.addEventListener('click', () => applyPreset('star'));
        if (pInfinity) pInfinity.addEventListener('click', () => applyPreset('infinity'));
        if (pCircle) pCircle.addEventListener('click', () => applyPreset('circle'));
        if (pHumanoid) pHumanoid.addEventListener('click', () => applyPreset('humanoid'));

        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                state.strokes = [];
                state.currentPoints = [];
                state.refImage = null;
                state.viewDraw = { zoom: 1, panX: 0, panY: 0 };
                state.viewRecon = { zoom: 1, panX: 0, panY: 0 };
                state.maxTerms = 20;
                state.playbackSpeed = 1.0;
                state.trailRatio = 1.0;
                state.smoothing = 20;
                state.showGuides = false;
                state.symmetryMode = 'off';

                const termsSlider = document.getElementById('terms');
                if (termsSlider) termsSlider.value = 20;
                const termsOut = document.getElementById('termsOut');
                if (termsOut) termsOut.textContent = '20 terms';

                EpiArt.drawing.renderDrawCanvas();
                renderLayersList();
                EpiArt.recon.recomputeAllGeometry();
            });
        }

        // Fourier Engine Sliders
        const termsSlider = document.getElementById('terms');
        const termsOut = document.getElementById('termsOut');
        if (termsSlider && termsOut) {
            termsSlider.addEventListener('input', (e) => {
                state.maxTerms = parseInt(e.target.value, 10);
                termsOut.textContent = `${state.maxTerms} terms`;
                state.strokes.forEach(s => s.trail = []);
                EpiArt.recon.updateBudgetReadout();
                updateOutput();
            });
        }

        const speedSlider = document.getElementById('speedSlider');
        const speedVal = document.getElementById('speedVal');
        if (speedSlider && speedVal) {
            speedSlider.addEventListener('input', (e) => {
                state.playbackSpeed = parseFloat(e.target.value);
                speedVal.textContent = `${state.playbackSpeed.toFixed(1)}x`;
            });
        }

        const densitySlider = document.getElementById('densitySlider');
        const densityVal = document.getElementById('densityVal');
        if (densitySlider && densityVal) {
            densitySlider.addEventListener('input', (e) => {
                state.N_RESAMPLE = parseInt(e.target.value, 10);
                densityVal.textContent = `${state.N_RESAMPLE} pts`;
            });
        }

        const reResampleBtn = document.getElementById('reResampleBtn');
        if (reResampleBtn) {
            reResampleBtn.addEventListener('click', reResampleAll);
        }

        const trailSlider = document.getElementById('trailSlider');
        const trailVal = document.getElementById('trailVal');
        if (trailSlider && trailVal) {
            trailSlider.addEventListener('input', (e) => {
                state.trailRatio = parseInt(e.target.value, 10) / 100;
                trailVal.textContent = `${e.target.value}%`;
            });
        }

        // Play / Pause Toggle
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                state.playing = !state.playing;
                playBtn.textContent = state.playing ? '❚❚ Pause' : '▶ Play';
                playBtn.classList.toggle('active', !state.playing);
            });
        }

        // Reference Overlay Toggle
        const overlayBtn = document.getElementById('overlayBtn');
        if (overlayBtn) {
            overlayBtn.addEventListener('click', () => {
                state.showOverlay = !state.showOverlay;
                overlayBtn.classList.toggle('active', state.showOverlay);
            });
        }

        // Sequential Stroke Toggle
        const seqBtn = document.getElementById('seqBtn');
        if (seqBtn) {
            seqBtn.addEventListener('click', () => {
                state.sequentialDraw = !state.sequentialDraw;
                seqBtn.textContent = state.sequentialDraw ? '⚡ Draw Strokes Sequentially: ON' : '⚡ Draw Strokes Sequentially: OFF';
                seqBtn.classList.toggle('active', state.sequentialDraw);
                state.t = 0;
                state.strokes.forEach(s => s.trail = []);
            });
        }

        // Fast-path Download Full JSON Button (always lossless)
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const visible = state.strokes.filter(s => s.visible);
                const payload = {
                    format: "EPI",
                    version: 1,
                    compression: "lossless",
                    meta: {
                        resamplePoints: state.N_RESAMPLE,
                        strokeCount: visible.length,
                        createdAt: new Date().toISOString(),
                        source: "EpiArt Studio v3"
                    },
                    strokes: visible.map(s => ({
                        id: s.id,
                        name: s.name,
                        color: s.color,
                        brushSize: s.brushSize,
                        opacity: s.opacity ?? 1.0,
                        locked: !!s.locked,
                        visible: s.visible,
                        epicyclesOverride: s.epicyclesOverride,
                        centroid: { x: EpiArt.utils.round(s.centroid.x, 2), y: EpiArt.utils.round(s.centroid.y, 2) },
                        coefficients: (s.coefficients || []).map(c => ({
                            freq: c.freq,
                            amp: EpiArt.utils.round(c.amp, 3),
                            phase: EpiArt.utils.round(c.phase, 4)
                        })),
                        rawPoints: s.rawPoints || []
                    }))
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'epiart_full_lossless.json';
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // Copy JSON Button
        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const outputEl = document.getElementById('output');
                if (outputEl) {
                    navigator.clipboard.writeText(outputEl.textContent).then(() => {
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = '✓ Copied!';
                        setTimeout(() => copyBtn.textContent = originalText, 1500);
                    });
                }
            });
        }

        // Download Render-Only JSON Button (Shortcut into modal pre-set to "Low")
        const downloadRenderBtn = document.getElementById('downloadRenderBtn');
        if (downloadRenderBtn) {
            downloadRenderBtn.addEventListener('click', () => {
                openCompressionModal('low');
            });
        }

        // Main Export Button to open Compression Modal
        const exportModalBtn = document.getElementById('exportModalBtn');
        if (exportModalBtn) {
            exportModalBtn.addEventListener('click', () => {
                openCompressionModal('lossless');
            });
        }

        // Compression Modal Event Handlers
        const compModal = document.getElementById('compressionModal');
        const modalCancelBtn = document.getElementById('modalCancelBtn');
        const modalCloseX = document.getElementById('modalCloseX');
        const modalDownloadBtn = document.getElementById('modalDownloadBtn');
        const customSlider = document.getElementById('modalCustomSlider');
        const customPctVal = document.getElementById('modalCustomPctVal');

        if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeCompressionModal);
        if (modalCloseX) modalCloseX.addEventListener('click', closeCompressionModal);
        if (modalDownloadBtn) modalDownloadBtn.addEventListener('click', executeModalDownload);

        // Grade radio buttons in modal
        const gradeRadios = document.querySelectorAll('input[name="compGrade"]');
        gradeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.compressionModal.grade = e.target.value;
                const customGroup = document.getElementById('customGradeGroup');
                if (customGroup) customGroup.style.display = e.target.value === 'custom' ? 'flex' : 'none';
                renderModalPreview();
            });
        });

        // Format radio buttons in modal (.epi vs .json)
        const formatRadios = document.querySelectorAll('input[name="compFormat"]');
        formatRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.compressionModal.format = e.target.value;
                renderModalPreview();
            });
        });

        if (customSlider && customPctVal) {
            customSlider.addEventListener('input', (e) => {
                state.compressionModal.customPercent = parseInt(e.target.value, 10);
                customPctVal.textContent = `${state.compressionModal.customPercent}%`;
                renderModalPreview();
            });
        }

        // File Import: Handles both .epi and .json with version branching and backward compatibility
        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        EpiArt.drawing.pushHistorySnapshot();

                        let loadedStrokes = [];

                        // Branch 1: Native .epi format with versioning
                        if (data.format === "EPI") {
                            const version = data.version || 1;
                            if (version >= 1 && Array.isArray(data.strokes)) {
                                loadedStrokes = data.strokes.map((s, idx) => {
                                    const stroke = {
                                        id: s.id || `stroke_${idx + 1}`,
                                        name: s.name || `Stroke ${idx + 1}`,
                                        color: s.color || '#38bdf8',
                                        brushSize: s.brushSize || 2,
                                        opacity: s.opacity ?? 1.0,
                                        rawPoints: s.rawPoints || [],
                                        visible: s.visible !== false,
                                        locked: !!s.locked,
                                        epicyclesOverride: s.epicyclesOverride ?? null,
                                        centroid: s.centroid || { x: 0, y: 0 },
                                        coefficients: s.coefficients || [],
                                        trail: []
                                    };

                                    // Synthesize points via inverse DFT if rawPoints are missing
                                    if (stroke.coefficients.length > 0 && stroke.rawPoints.length === 0) {
                                        const res = [];
                                        const M = state.N_RESAMPLE;
                                        for (let n = 0; n < M; n++) {
                                            let x = stroke.centroid.x, y = stroke.centroid.y;
                                            const tt = (2 * Math.PI * n) / M;
                                            stroke.coefficients.forEach(c => {
                                                const ang = c.freq * tt + c.phase;
                                                x += c.amp * Math.cos(ang);
                                                y += c.amp * Math.sin(ang);
                                            });
                                            res.push({ x, y });
                                        }
                                        stroke.rawPoints = res;
                                        stroke.resampled = res;
                                    } else if (stroke.rawPoints.length > 0) {
                                        EpiArt.math.computeStrokeDFT(stroke, state.N_RESAMPLE);
                                    }

                                    return stroke;
                                });
                            }
                        }
                        // Branch 2: Legacy v2 flat array or object format fallback
                        else if (Array.isArray(data)) {
                            // Flat array of points (v1 single stroke)
                            const singleStroke = {
                                id: 'stroke_imported_1',
                                name: 'Stroke 1',
                                color: state.currentColor,
                                brushSize: state.currentWidth,
                                opacity: 1.0,
                                rawPoints: data,
                                visible: true,
                                locked: false,
                                epicyclesOverride: null,
                                trail: []
                            };
                            EpiArt.math.computeStrokeDFT(singleStroke, state.N_RESAMPLE);
                            loadedStrokes = [singleStroke];
                        } else if (data.strokes && Array.isArray(data.strokes)) {
                            // v2 Multi-stroke object
                            loadedStrokes = data.strokes.map((s, idx) => {
                                const stroke = {
                                    id: s.id || `stroke_${idx + 1}`,
                                    name: s.name || `Stroke ${idx + 1}`,
                                    color: s.color || '#38bdf8',
                                    brushSize: s.brushSize || 2,
                                    opacity: s.opacity ?? 1.0,
                                    rawPoints: s.rawPoints || [],
                                    visible: s.visible !== false,
                                    locked: false,
                                    epicyclesOverride: s.epicyclesOverride ?? null,
                                    centroid: s.centroid || { x: 0, y: 0 },
                                    coefficients: s.coefficients || [],
                                    trail: []
                                };

                                if (stroke.coefficients.length > 0 && stroke.rawPoints.length === 0) {
                                    const res = [];
                                    const M = state.N_RESAMPLE;
                                    for (let n = 0; n < M; n++) {
                                        let x = stroke.centroid.x, y = stroke.centroid.y;
                                        const tt = (2 * Math.PI * n) / M;
                                        stroke.coefficients.forEach(c => {
                                            const ang = c.freq * tt + c.phase;
                                            x += c.amp * Math.cos(ang);
                                            y += c.amp * Math.sin(ang);
                                        });
                                        res.push({ x, y });
                                    }
                                    stroke.rawPoints = res;
                                    stroke.resampled = res;
                                } else if (stroke.rawPoints.length > 0) {
                                    EpiArt.math.computeStrokeDFT(stroke, state.N_RESAMPLE);
                                }

                                return stroke;
                            });
                        }

                        if (loadedStrokes.length > 0) {
                            state.strokes = loadedStrokes;
                            EpiArt.drawing.renderDrawCanvas();
                            renderLayersList();
                            EpiArt.recon.recomputeAllGeometry();
                        } else {
                            alert('No valid stroke data found in file.');
                        }
                    } catch (err) {
                        alert('Could not parse file. Invalid .epi or .json format.');
                    }
                };
                reader.readAsText(file);
            });
        }

        // --- Layout Mode & Views Synchronization ---
        const layoutSideBySideBtn = document.getElementById('layoutSideBySideBtn');
        const layoutStackedBtn = document.getElementById('layoutStackedBtn');
        const syncViewBtn = document.getElementById('syncViewBtn');
        const stackedDivider = document.getElementById('stackedDivider');
        const stageContainer = document.getElementById('stageContainer');
        const toggleLeftRailBtn = document.getElementById('toggleLeftRailBtn');
        const toggleRightRailBtn = document.getElementById('toggleRightRailBtn');
        const workspaceEl = document.getElementById('workspaceEl');
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');

        // Restore Saved Layout Settings from LocalStorage
        try {
            const savedLayout = localStorage.getItem('epiart_layout_mode');
            if (savedLayout === 'stacked' || savedLayout === 'side-by-side') {
                state.layoutMode = savedLayout;
            }
            const savedRatio = parseFloat(localStorage.getItem('epiart_stacked_ratio'));
            if (!isNaN(savedRatio) && savedRatio >= 0.2 && savedRatio <= 0.8) {
                state.stackedRatio = savedRatio;
            }
            const savedSync = localStorage.getItem('epiart_sync_views');
            if (savedSync === 'true') {
                state.syncViews = true;
            }
            const savedLeftCol = localStorage.getItem('epiart_left_collapsed');
            if (savedLeftCol === 'true') {
                state.leftRailCollapsed = true;
            }
            const savedRightCol = localStorage.getItem('epiart_right_collapsed');
            if (savedRightCol === 'true') {
                state.rightRailCollapsed = true;
            }
        } catch (e) {}

        // Initialize Layout Mode & Stacked Ratio
        setLayoutMode(state.layoutMode);

        if (layoutSideBySideBtn) {
            layoutSideBySideBtn.addEventListener('click', () => setLayoutMode('side-by-side'));
        }
        if (layoutStackedBtn) {
            layoutStackedBtn.addEventListener('click', () => setLayoutMode('stacked'));
        }

        // Sync View Toggle
        if (syncViewBtn) {
            syncViewBtn.classList.toggle('active', state.syncViews);
            syncViewBtn.textContent = state.syncViews ? '🔗 Sync View: ON' : '🔗 Sync View: OFF';
            syncViewBtn.addEventListener('click', () => {
                state.syncViews = !state.syncViews;
                syncViewBtn.classList.toggle('active', state.syncViews);
                syncViewBtn.textContent = state.syncViews ? '🔗 Sync View: ON' : '🔗 Sync View: OFF';
                try {
                    localStorage.setItem('epiart_sync_views', state.syncViews.toString());
                } catch (e) {}
                if (state.syncViews) {
                    state.viewRecon.zoom = state.viewDraw.zoom;
                    state.viewRecon.panX = state.viewDraw.panX;
                    state.viewRecon.panY = state.viewDraw.panY;
                }
            });
        }

        // Draggable Horizontal Divider for Stacked Mode
        if (stackedDivider && stageContainer) {
            let isDraggingDivider = false;

            const onPointerMove = (e) => {
                if (!isDraggingDivider) return;
                const rect = stageContainer.getBoundingClientRect();
                if (rect.height <= 0) return;
                const rawRatio = (e.clientY - rect.top) / rect.height;
                const clamped = Math.max(0.2, Math.min(0.8, rawRatio));
                applyStackedRatio(clamped);
                if (EpiArt.resizeAll) EpiArt.resizeAll();
            };

            const onPointerUp = () => {
                if (isDraggingDivider) {
                    isDraggingDivider = false;
                    stackedDivider.classList.remove('dragging');
                    document.body.style.cursor = '';
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    if (EpiArt.resizeAll) EpiArt.resizeAll();
                }
            };

            stackedDivider.addEventListener('pointerdown', (e) => {
                isDraggingDivider = true;
                stackedDivider.classList.add('dragging');
                document.body.style.cursor = 'row-resize';
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            });
        }

        // Side Rails Collapse Handling
        function updateRailStates() {
            if (!workspaceEl) return;
            workspaceEl.classList.toggle('left-collapsed', state.leftRailCollapsed);
            workspaceEl.classList.toggle('right-collapsed', state.rightRailCollapsed);
            if (leftPanel) leftPanel.classList.toggle('collapsed', state.leftRailCollapsed);
            if (rightPanel) rightPanel.classList.toggle('collapsed', state.rightRailCollapsed);

            if (toggleLeftRailBtn) {
                toggleLeftRailBtn.textContent = state.leftRailCollapsed ? '▶ Layers' : '◀ Layers';
                toggleLeftRailBtn.classList.toggle('active', state.leftRailCollapsed);
            }
            if (toggleRightRailBtn) {
                toggleRightRailBtn.textContent = state.rightRailCollapsed ? 'Engine ◀' : 'Engine ▶';
                toggleRightRailBtn.classList.toggle('active', state.rightRailCollapsed);
            }

            try {
                localStorage.setItem('epiart_left_collapsed', state.leftRailCollapsed.toString());
                localStorage.setItem('epiart_right_collapsed', state.rightRailCollapsed.toString());
            } catch (e) {}

            if (EpiArt.resizeAll) EpiArt.resizeAll();
        }

        if (toggleLeftRailBtn) {
            toggleLeftRailBtn.addEventListener('click', () => {
                state.leftRailCollapsed = !state.leftRailCollapsed;
                updateRailStates();
            });
        }
        if (toggleRightRailBtn) {
            toggleRightRailBtn.addEventListener('click', () => {
                state.rightRailCollapsed = !state.rightRailCollapsed;
                updateRailStates();
            });
        }
        updateRailStates();
    }

    EpiArt.ui = {
        renderLayersList,
        reResampleAll,
        applyPreset,
        updateOutput,
        openCompressionModal,
        closeCompressionModal,
        renderModalPreview,
        setLayoutMode,
        applyStackedRatio,
        setupUI
    };
})();
