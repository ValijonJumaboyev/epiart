// EpiArt — Math & Fourier Engine Module (Studio v3)
window.EpiArt = window.EpiArt || {};

(function () {
    const { utils } = EpiArt;

    // Discrete Fourier Transform on 2D points
    function computeDFT(points) {
        const M = points.length;
        if (M === 0) return [];
        const out = [];
        for (let k = 0; k < M; k++) {
            let re = 0, im = 0;
            for (let n = 0; n < M; n++) {
                const phi = (2 * Math.PI * k * n) / M;
                const x = points[n].x, y = points[n].y;
                re += x * Math.cos(phi) + y * Math.sin(phi);
                im += y * Math.cos(phi) - x * Math.sin(phi);
            }
            re /= M;
            im /= M;
            const freq = k <= M / 2 ? k : k - M;
            const amp = Math.hypot(re, im);
            const phase = Math.atan2(im, re);
            out.push({ freq, amp, phase });
        }
        // Sort frequencies by descending amplitude
        out.sort((a, b) => b.amp - a.amp);
        return out;
    }

    // Compute arc-length resampling, centroid, and DFT for a single stroke
    function computeStrokeDFT(stroke, nPoints) {
        if (!stroke.rawPoints || stroke.rawPoints.length === 0) {
            stroke.resampled = [];
            stroke.centroid = { x: 0, y: 0 };
            stroke.coefficients = [];
            return;
        }

        stroke.resampled = utils.resamplePoints(stroke.rawPoints, nPoints);
        let cx = 0, cy = 0;
        stroke.resampled.forEach(p => { cx += p.x; cy += p.y; });
        cx /= stroke.resampled.length;
        cy /= stroke.resampled.length;
        stroke.centroid = { x: cx, y: cy };

        const centered = stroke.resampled.map(p => ({ x: p.x - cx, y: p.y - cy }));
        stroke.coefficients = computeDFT(centered);
    }

    // Evaluate epicycles series at time t with up to nTerms
    function evaluateCoeffs(coefficients, t, nTerms) {
        const chain = [{ x: 0, y: 0 }];
        let curX = 0, curY = 0;
        const count = Math.min(nTerms, coefficients.length);

        for (let i = 0; i < count; i++) {
            const c = coefficients[i];
            const angle = c.freq * t + c.phase;
            curX += c.amp * Math.cos(angle);
            curY += c.amp * Math.sin(angle);
            chain.push({ x: curX, y: curY });
        }
        return chain;
    }

    // Truncate stroke coefficients according to compression ratio (0.01 - 1.0)
    function truncateCoefficients(coefficients, ratio) {
        if (!coefficients || coefficients.length === 0) return [];
        if (ratio >= 0.999) return [...coefficients];

        const targetCount = Math.max(1, Math.round(coefficients.length * ratio));
        
        // Find DC component (freq === 0) to preserve baseline offset
        const dcIndex = coefficients.findIndex(c => c.freq === 0);
        let selected = [];

        if (dcIndex !== -1 && dcIndex >= targetCount) {
            // Include DC term explicitly if it fell outside top targetCount
            selected = coefficients.slice(0, targetCount - 1);
            selected.push(coefficients[dcIndex]);
        } else {
            selected = coefficients.slice(0, targetCount);
        }

        return selected;
    }

    // Get compression ratio for a given grade name
    function getGradeRatio(grade, customPercent = 50) {
        switch (grade) {
            case 'lossless': return 1.0;
            case 'high': return 0.60;
            case 'medium': return 0.25;
            case 'low': return 0.10;
            case 'custom': return Math.max(0.01, Math.min(1.0, customPercent / 100));
            default: return 1.0;
        }
    }

    // Calculate term count summary and estimated file size
    function calculateCompressionMetrics(strokes, grade, customPercent = 50, format = 'epi') {
        const ratio = getGradeRatio(grade, customPercent);
        let totalTerms = 0;
        let originalTerms = 0;

        const simulatedStrokes = strokes.map(s => {
            const origLen = s.coefficients ? s.coefficients.length : 0;
            originalTerms += origLen;
            const truncated = truncateCoefficients(s.coefficients, ratio);
            totalTerms += truncated.length;

            return {
                id: s.id,
                name: s.name || 'Stroke',
                color: s.color,
                brushSize: s.brushSize,
                opacity: s.opacity ?? 1.0,
                locked: !!s.locked,
                visible: s.visible !== false,
                epicyclesOverride: s.epicyclesOverride,
                centroid: { x: utils.round(s.centroid.x, 2), y: utils.round(s.centroid.y, 2) },
                coefficients: truncated.map(c => ({
                    freq: c.freq,
                    amp: utils.round(c.amp, 3),
                    phase: utils.round(c.phase, 4)
                }))
            };
        });

        const payload = format === 'epi' ? {
            format: "EPI",
            version: 1,
            compression: grade,
            meta: {
                resamplePoints: EpiArt.state ? EpiArt.state.N_RESAMPLE : 300,
                strokeCount: simulatedStrokes.length,
                createdAt: new Date().toISOString(),
                source: "EpiArt Studio v3"
            },
            strokes: simulatedStrokes
        } : {
            type: "epiart-render-only",
            version: 3,
            compression: grade,
            globalCentroid: EpiArt.state ? EpiArt.state.globalCentroid : { x: 0, y: 0 },
            strokes: simulatedStrokes
        };

        const jsonStr = JSON.stringify(payload);
        const estimatedBytes = new Blob([jsonStr]).size;
        const estimatedKB = (estimatedBytes / 1024).toFixed(1);

        return {
            ratio,
            totalTerms,
            originalTerms,
            percentRetained: originalTerms > 0 ? Math.round((totalTerms / originalTerms) * 100) : 100,
            estimatedBytes,
            estimatedKB,
            payload
        };
    }

    EpiArt.math = {
        computeDFT,
        computeStrokeDFT,
        evaluateCoeffs,
        truncateCoefficients,
        getGradeRatio,
        calculateCompressionMetrics
    };
})();
