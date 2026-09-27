// EpiArt — Central Studio Bootstrapper (Studio v3)
window.EpiArt = window.EpiArt || {};

(function () {
    const state = EpiArt.state;

    function resizeCanvas(cv, ctx) {
        if (!cv || !ctx) return;
        const rect = cv.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        state.dpr = window.devicePixelRatio || 1;
        cv.width = rect.width * state.dpr;
        cv.height = rect.height * state.dpr;
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }

    function resizeAll() {
        if (state.drawCv && state.drawCtx) resizeCanvas(state.drawCv, state.drawCtx);
        if (state.reconCv && state.reconCtx) resizeCanvas(state.reconCv, state.reconCtx);
        EpiArt.drawing.renderDrawCanvas();
    }

    // Studio Initialization Entry Point
    function init() {
        resizeAll();
        window.addEventListener('resize', resizeAll);

        // Initialize Module Listeners
        EpiArt.drawing.initDrawingEvents();
        EpiArt.recon.initReconEvents();
        EpiArt.ui.setupUI();
        EpiArt.ui.renderLayersList();

        // Start Animation Loop
        requestAnimationFrame(EpiArt.recon.loop);
    }

    // Auto-boot if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    EpiArt.init = init;
    EpiArt.resizeAll = resizeAll;
})();