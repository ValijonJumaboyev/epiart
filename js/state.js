// EpiArt — Centralized State Management (Studio v3)
window.EpiArt = window.EpiArt || {};

(function () {
    const drawCv = document.getElementById('drawCv');
    const drawCtx = drawCv ? drawCv.getContext('2d') : null;
    const reconCv = document.getElementById('reconCv');
    const reconCtx = reconCv ? reconCv.getContext('2d') : null;

    EpiArt.state = {
        // Canvases and contexts
        drawCv,
        drawCtx,
        reconCv,
        reconCtx,

        // High-DPI
        dpr: window.devicePixelRatio || 1,

        // Viewport Transforms (Zoom & Pan in screen-space, independent of canvas data points)
        viewDraw: { zoom: 1, panX: 0, panY: 0 },
        viewRecon: { zoom: 1, panX: 0, panY: 0 },
        isPanning: false,
        panCanvas: null, // 'draw' | 'recon' | null
        panStart: { x: 0, y: 0 },
        spacePressed: false,
        syncViews: false, // Optional sync zoom/pan between both canvases

        // Layout Configuration
        layoutMode: 'side-by-side', // 'side-by-side' | 'stacked'
        stackedRatio: 0.6, // Ratio for stacked mode (top canvas height / total height)
        leftRailCollapsed: false,
        rightRailCollapsed: false,

        // Multi-Stroke Data Model
        // Each stroke: { id, name, color, brushSize, opacity, rawPoints, resampled, centroid, coefficients, visible, locked, epicyclesOverride, trail }
        strokes: [],
        currentPoints: [],
        drawing: false,
        currentTool: 'pen', // 'pen' | 'eraser'
        currentColor: '#38bdf8',
        currentWidth: 2,
        eraserRadius: 15,

        // Drawing Quality & Aids
        smoothing: 20, // 0 = raw, 100 = aggressive
        snapToClose: true,
        snapRadius: 12, // px distance to auto-close loop
        showGuides: false,
        symmetryMode: 'off', // 'off' | 'vertical' | 'horizontal'
        symmetryAxis: null, // canvas x-coordinate for vertical or y-coordinate for horizontal

        // Reference Image Layer (locked background, excluded from exports and DFT)
        refImage: null, // { img, opacity: 0.5, visible: true, width, height, x: 0, y: 0 }

        // Reconstruction Geometry & Viewport
        globalCentroid: { x: 0, y: 0 },
        scaleF: 1,
        maxTerms: 20,
        hasContent: false,
        epicycleBudgetMax: 500,

        // Animation & Timing
        t: 0,
        playing: true,
        showOverlay: true,
        sequentialDraw: false,

        // Settings & Configurations
        N_RESAMPLE: 300,
        playbackSpeed: 1.0,
        trailRatio: 1.0, // 0.1 to 1.0

        // Granular Undo
        inStrokeHistory: [], // Checkpoint points within an active stroke
        historyStack: [],    // Stack of completed actions { type, strokesSnapshot }

        // Compression Modal State
        compressionModal: {
            isOpen: false,
            format: 'epi', // 'epi' | 'json'
            grade: 'lossless', // 'lossless' | 'high' | 'medium' | 'low' | 'custom'
            customPercent: 50
        }
    };
})();
