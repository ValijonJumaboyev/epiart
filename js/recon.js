// EpiArt — Reconstruction & Harmonic Epicycles Engine Module (Studio v3)
window.EpiArt = window.EpiArt || {};

(function () {
    // Recompute Global Transform & Bounds across all visible strokes
    function recomputeAllGeometry() {
        const state = EpiArt.state;
        const visibleStrokes = state.strokes.filter(s => s.visible && s.resampled && s.resampled.length > 0);

        if (visibleStrokes.length === 0) {
            state.hasContent = false;
            const badge = document.getElementById('epicycleBadge');
            if (badge) badge.textContent = 'Ready';
            updateBudgetReadout();
            EpiArt.ui.updateOutput();
            return;
        }

        state.hasContent = true;

        // Calculate global bounding box of all visible stroke points
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        visibleStrokes.forEach(s => {
            s.resampled.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
        });

        state.globalCentroid = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const maxR = Math.max(10, Math.hypot((maxX - minX) / 2, (maxY - minY) / 2));

        const r = state.reconCv.getBoundingClientRect();
        state.scaleF = (Math.min(r.width, r.height) * 0.4) / maxR;

        let maxCoeffsCount = 0;
        visibleStrokes.forEach(s => {
            if (s.coefficients) maxCoeffsCount = Math.max(maxCoeffsCount, s.coefficients.length);
        });

        const termsSlider = document.getElementById('terms');
        if (termsSlider) termsSlider.max = Math.max(50, maxCoeffsCount);

        const termsOut = document.getElementById('termsOut');
        if (termsOut) termsOut.textContent = `${state.maxTerms} terms`;

        const epicycleBadge = document.getElementById('epicycleBadge');
        if (epicycleBadge) {
            epicycleBadge.textContent = `${visibleStrokes.length} active stroke${visibleStrokes.length === 1 ? '' : 's'}`;
        }

        updateBudgetReadout();

        state.t = 0;
        visibleStrokes.forEach(s => s.trail = []);
        EpiArt.ui.updateOutput();
    }

    // Update Live Epicycle Budget Readout
    function updateBudgetReadout() {
        const state = EpiArt.state;
        const visibleStrokes = state.strokes.filter(s => s.visible && s.coefficients && s.coefficients.length > 0);
        let activeTerms = 0;

        visibleStrokes.forEach(s => {
            const count = s.epicyclesOverride !== null ? s.epicyclesOverride : state.maxTerms;
            activeTerms += Math.min(count, s.coefficients.length);
        });

        const budgetEl = document.getElementById('budgetVal');
        if (budgetEl) {
            budgetEl.textContent = `${activeTerms} / ${state.epicycleBudgetMax}`;
            if (activeTerms > state.epicycleBudgetMax) {
                budgetEl.style.color = 'var(--accent-pink)';
            } else if (activeTerms > state.epicycleBudgetMax * 0.8) {
                budgetEl.style.color = 'var(--accent-amber)';
            } else {
                budgetEl.style.color = 'var(--accent-cyan)';
            }
        }
    }

    // Initialize Zoom & Pan on Harmonic Epicycles Canvas
    function initReconEvents() {
        const { reconCv } = EpiArt.state;
        if (!reconCv) return;

        let reconPanLastPos = null;

        reconCv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const view = EpiArt.state.viewRecon;
            const mouseScreen = EpiArt.utils.getScreenPos(reconCv, e);

            const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
            const newZoom = Math.max(0.2, Math.min(12, view.zoom * zoomFactor));

            view.panX = mouseScreen.x - (mouseScreen.x - view.panX) * (newZoom / view.zoom);
            view.panY = mouseScreen.y - (mouseScreen.y - view.panY) * (newZoom / view.zoom);
            view.zoom = newZoom;

            if (EpiArt.state.syncViews) {
                EpiArt.state.viewDraw.zoom = view.zoom;
                EpiArt.state.viewDraw.panX = view.panX;
                EpiArt.state.viewDraw.panY = view.panY;
                EpiArt.drawing.renderDrawCanvas();
            }
        }, { passive: false });

        reconCv.addEventListener('pointerdown', (e) => {
            if (EpiArt.state.spacePressed || e.button === 1 || e.button === 0) {
                // Drag to pan epicycles view
                EpiArt.state.isPanning = true;
                EpiArt.state.panCanvas = 'recon';
                reconPanLastPos = { x: e.clientX, y: e.clientY };
                reconCv.style.cursor = 'grabbing';
                reconCv.setPointerCapture(e.pointerId);
            }
        });

        reconCv.addEventListener('pointermove', (e) => {
            if (EpiArt.state.isPanning && EpiArt.state.panCanvas === 'recon' && reconPanLastPos) {
                const dx = e.clientX - reconPanLastPos.x;
                const dy = e.clientY - reconPanLastPos.y;
                reconPanLastPos = { x: e.clientX, y: e.clientY };

                EpiArt.state.viewRecon.panX += dx;
                EpiArt.state.viewRecon.panY += dy;

                if (EpiArt.state.syncViews) {
                    EpiArt.state.viewDraw.panX = EpiArt.state.viewRecon.panX;
                    EpiArt.state.viewDraw.panY = EpiArt.state.viewRecon.panY;
                    EpiArt.drawing.renderDrawCanvas();
                }
            }
        });

        reconCv.addEventListener('pointerup', (e) => {
            if (EpiArt.state.panCanvas === 'recon') {
                EpiArt.state.isPanning = false;
                EpiArt.state.panCanvas = null;
                reconPanLastPos = null;
                reconCv.style.cursor = EpiArt.state.spacePressed ? 'grab' : 'default';
            }
        });
    }

    // Main Animation Loop for Multi-Stroke Reconstruction Canvas
    function loop() {
        const state = EpiArt.state;
        const { reconCv, reconCtx, viewRecon } = state;

        if (reconCv && reconCtx) {
            const r = reconCv.getBoundingClientRect();
            reconCtx.clearRect(0, 0, reconCv.width, reconCv.height);

            // High-DPI Grid Canvas View Transform
            reconCtx.save();
            reconCtx.translate(viewRecon.panX, viewRecon.panY);
            reconCtx.scale(viewRecon.zoom, viewRecon.zoom);

            const canvasW = reconCv.width / state.dpr;
            const canvasH = reconCv.height / state.dpr;

            // Background concentric harmonic grid
            reconCtx.save();
            reconCtx.translate(canvasW / 2, canvasH / 2);
            reconCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            reconCtx.lineWidth = 1 / viewRecon.zoom;
            for (let gr = 60; gr < Math.max(canvasW, canvasH); gr += 60) {
                reconCtx.beginPath();
                reconCtx.arc(0, 0, gr, 0, 2 * Math.PI);
                reconCtx.stroke();
            }
            reconCtx.restore();

            // Transform into centered harmonic drawing space
            reconCtx.save();
            reconCtx.translate(canvasW / 2, canvasH / 2);
            reconCtx.scale(state.scaleF, state.scaleF);

            // Filter visible strokes in strictly preserved layer order (determines Z-index!)
            const visibleStrokes = state.strokes.filter(s => s.visible && s.coefficients && s.coefficients.length > 0);

            const totalStrokes = visibleStrokes.length;
            const strokeWindow = (2 * Math.PI) / Math.max(1, totalStrokes);

            visibleStrokes.forEach((stroke, idx) => {
                let strokeT = state.t;

                if (state.sequentialDraw && totalStrokes > 1) {
                    const strokeStart = idx * strokeWindow;
                    if (state.t < strokeStart) return; // Not started yet

                    const normProgress = Math.min(1.0, (state.t - strokeStart) / strokeWindow);
                    strokeT = normProgress * 2 * Math.PI;
                }

                const nTerms = stroke.epicyclesOverride !== null ? stroke.epicyclesOverride : state.maxTerms;
                const chain = EpiArt.math.evaluateCoeffs(stroke.coefficients, strokeT, nTerms);

                // Shift chain by stroke centroid relative to global centroid
                const rootX = stroke.centroid.x - state.globalCentroid.x;
                const rootY = stroke.centroid.y - state.globalCentroid.y;

                const shiftedChain = chain.map(pt => ({ x: pt.x + rootX, y: pt.y + rootY }));

                // Render reference overlay outline if enabled
                if (state.showOverlay && stroke.resampled && stroke.resampled.length > 0) {
                    reconCtx.save();
                    reconCtx.globalAlpha = (stroke.opacity ?? 1.0) * 0.22;
                    reconCtx.strokeStyle = stroke.color;
                    reconCtx.lineWidth = 1.2 / (state.scaleF * viewRecon.zoom);
                    reconCtx.beginPath();
                    stroke.resampled.forEach((p, i) => {
                        const x = p.x - state.globalCentroid.x, y = p.y - state.globalCentroid.y;
                        i === 0 ? reconCtx.moveTo(x, y) : reconCtx.lineTo(x, y);
                    });
                    reconCtx.stroke();
                    reconCtx.restore();
                }

                // Draw Epicycle Circles
                reconCtx.save();
                reconCtx.globalAlpha = (stroke.opacity ?? 1.0) * 0.32;
                reconCtx.strokeStyle = stroke.color;
                reconCtx.lineWidth = 0.8 / (state.scaleF * viewRecon.zoom);
                for (let i = 1; i < shiftedChain.length; i++) {
                    const cx0 = shiftedChain[i - 1].x, cy0 = shiftedChain[i - 1].y;
                    const radius = Math.hypot(shiftedChain[i].x - cx0, shiftedChain[i].y - cy0);
                    reconCtx.beginPath();
                    reconCtx.arc(cx0, cy0, radius, 0, 2 * Math.PI);
                    reconCtx.stroke();
                }

                // Draw Epicycle Connecting Vectors
                reconCtx.globalAlpha = (stroke.opacity ?? 1.0) * 0.7;
                reconCtx.lineWidth = 1.2 / (state.scaleF * viewRecon.zoom);
                reconCtx.beginPath();
                shiftedChain.forEach((p, i) => i === 0 ? reconCtx.moveTo(p.x, p.y) : reconCtx.lineTo(p.x, p.y));
                reconCtx.stroke();
                reconCtx.restore();

                // Tip position & Trail
                const tip = shiftedChain[shiftedChain.length - 1];
                if (!stroke.trail) stroke.trail = [];
                stroke.trail.push({ x: tip.x, y: tip.y });

                const maxTrailPoints = Math.floor(state.N_RESAMPLE * state.trailRatio);
                if (stroke.trail.length > maxTrailPoints) {
                    stroke.trail.splice(0, stroke.trail.length - maxTrailPoints);
                }

                // Draw glowing tip trail
                reconCtx.save();
                reconCtx.globalAlpha = stroke.opacity ?? 1.0;
                reconCtx.strokeStyle = stroke.color;
                reconCtx.lineWidth = Math.max(1.5, stroke.brushSize) / state.scaleF;
                reconCtx.lineJoin = 'round';
                reconCtx.lineCap = 'round';
                reconCtx.beginPath();
                stroke.trail.forEach((p, i) => i === 0 ? reconCtx.moveTo(p.x, p.y) : reconCtx.lineTo(p.x, p.y));
                reconCtx.stroke();

                // Draw tip dot
                reconCtx.fillStyle = stroke.color;
                reconCtx.beginPath();
                reconCtx.arc(tip.x, tip.y, 3.5 / (state.scaleF * viewRecon.zoom), 0, 2 * Math.PI);
                reconCtx.fill();
                reconCtx.restore();
            });

            reconCtx.restore();
            reconCtx.restore();

            // Increment time parameter
            if (state.playing) {
                state.t += (2 * Math.PI * state.playbackSpeed) / state.N_RESAMPLE;
                if (state.t > 2 * Math.PI) {
                    state.t -= 2 * Math.PI;
                    visibleStrokes.forEach(s => s.trail = []);
                }
            }
        }

        requestAnimationFrame(loop);
    }

    EpiArt.recon = {
        recomputeAllGeometry,
        updateBudgetReadout,
        initReconEvents,
        loop
    };
})();
