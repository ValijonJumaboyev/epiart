// EpiArt — Utilities Module (Studio v3)
window.EpiArt = window.EpiArt || {};

(function () {
    // Helper to get screen-relative coordinates within canvas element
    function getScreenPos(cv, e) {
        const r = cv.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
    }

    // Convert screen coordinates to canvas-space coordinates via view transform
    function screenToCanvas(screenPt, view) {
        return {
            x: (screenPt.x - view.panX) / view.zoom,
            y: (screenPt.y - view.panY) / view.zoom
        };
    }

    // Convert canvas-space coordinates to screen coordinates
    function canvasToScreen(canvasPt, view) {
        return {
            x: canvasPt.x * view.zoom + view.panX,
            y: canvasPt.y * view.zoom + view.panY
        };
    }

    // Get pointer position directly in canvas-space coordinates
    function getPos(cv, e, view) {
        const screenPt = getScreenPos(cv, e);
        if (!view) return screenPt;
        return screenToCanvas(screenPt, view);
    }

    // Distance squared from point to line segment
    function distToSegmentSq(p, v, w) {
        const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
        if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
        let tt = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        tt = Math.max(0, Math.min(1, tt));
        const proj = { x: v.x + tt * (w.x - v.x), y: v.y + tt * (w.y - v.y) };
        return (p.x - proj.x) ** 2 + (p.y - proj.y) ** 2;
    }

    // Check if a point is near any segment of a stroke's raw points
    function isNearStroke(pt, stroke, threshold = 10) {
        const threshSq = threshold * threshold;
        for (let i = 0; i < stroke.rawPoints.length - 1; i++) {
            if (distToSegmentSq(pt, stroke.rawPoints[i], stroke.rawPoints[i + 1]) <= threshSq) {
                return true;
            }
        }
        return false;
    }

    // Ramer-Douglas-Peucker (RDP) algorithm for point simplification
    function simplifyRDP(points, epsilon) {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let index = 0;
        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const d = Math.sqrt(distToSegmentSq(points[i], first, last));
            if (d > maxDist) {
                maxDist = d;
                index = i;
            }
        }

        if (maxDist > epsilon) {
            const left = simplifyRDP(points.slice(0, index + 1), epsilon);
            const right = simplifyRDP(points.slice(index), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [first, last];
        }
    }

    // Catmull-Rom spline interpolation between points
    function smoothCatmullRom(points, tension = 0.5, segmentsPerSpan = 4) {
        if (points.length < 3) return points;

        const out = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = i > 0 ? points[i - 1] : points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = i < points.length - 2 ? points[i + 2] : p2;

            for (let t = 0; t < segmentsPerSpan; t++) {
                const s = t / segmentsPerSpan;
                const s2 = s * s;
                const s3 = s2 * s;

                // Catmull-Rom basis matrix
                const b1 = -tension * s3 + 2 * tension * s2 - tension * s;
                const b2 = (2 - tension) * s3 + (tension - 3) * s2 + 1;
                const b3 = (tension - 2) * s3 + (3 - 2 * tension) * s2 + tension * s;
                const b4 = tension * s3 - tension * s2;

                const x = b1 * p0.x + b2 * p1.x + b3 * p2.x + b4 * p3.x;
                const y = b1 * p0.y + b2 * p1.y + b3 * p2.y + b4 * p3.y;
                out.push({ x, y });
            }
        }
        out.push(points[points.length - 1]);
        return out;
    }

    // Combined stroke smoothing
    function smoothStroke(rawPoints, smoothingPercent) {
        if (!rawPoints || rawPoints.length < 3 || smoothingPercent <= 0) {
            return rawPoints ? [...rawPoints] : [];
        }

        // Map 0-100 to epsilon range [0.5, 6.0]
        const epsilon = 0.5 + (smoothingPercent / 100) * 5.5;
        const simplified = simplifyRDP(rawPoints, epsilon);

        if (simplified.length < 3) return simplified;

        // Apply Catmull-Rom smoothing to restore curvature smoothly
        return smoothCatmullRom(simplified, 0.4, 3);
    }

    // Snap-to-close: if end point is near start point, snap it closed
    function checkSnapClose(points, snapRadius = 12) {
        if (!points || points.length < 4) return points;
        const first = points[0];
        const last = points[points.length - 1];
        const dist = Math.hypot(last.x - first.x, last.y - first.y);
        if (dist <= snapRadius) {
            const snapped = [...points];
            snapped[snapped.length - 1] = { x: first.x, y: first.y };
            return snapped;
        }
        return points;
    }

    // Real Point-Range Eraser helper: remove points within radius and split into contiguous segments
    function erasePointsFromStroke(rawPoints, eraserPos, radius) {
        if (!rawPoints || rawPoints.length === 0) return [];
        const radiusSq = radius * radius;

        const segments = [];
        let currentSegment = [];

        for (let i = 0; i < rawPoints.length; i++) {
            const pt = rawPoints[i];
            const dx = pt.x - eraserPos.x;
            const dy = pt.y - eraserPos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq > radiusSq) {
                currentSegment.push(pt);
            } else {
                if (currentSegment.length >= 2) {
                    segments.push(currentSegment);
                }
                currentSegment = [];
            }
        }

        if (currentSegment.length >= 2) {
            segments.push(currentSegment);
        }

        return segments;
    }

    // Arc-length resample a path of points into equidistant N points
    function resamplePoints(points, n) {
        if (!points || points.length === 0) return [];
        if (points.length === 1) return Array(n).fill({ x: points[0].x, y: points[0].y });

        const dists = [0];
        for (let i = 1; i < points.length; i++) {
            dists.push(dists[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
        }
        const total = dists[dists.length - 1];
        if (total < 1e-3) return Array(n).fill({ x: points[0].x, y: points[0].y });

        const out = [];
        for (let i = 0; i < n; i++) {
            const target = (i / n) * total;
            let j = 1;
            while (j < dists.length - 1 && dists[j] < target) j++;
            const d0 = dists[j - 1], d1 = dists[j];
            const tt = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
            const p0 = points[j - 1], p1 = points[j];
            out.push({ x: p0.x + (p1.x - p0.x) * tt, y: p0.y + (p1.y - p0.y) * tt });
        }
        return out;
    }

    // Decimal rounding helper
    function round(n, d) {
        const f = Math.pow(10, d);
        return Math.round(n * f) / f;
    }

    EpiArt.utils = {
        getScreenPos,
        screenToCanvas,
        canvasToScreen,
        getPos,
        distToSegmentSq,
        isNearStroke,
        simplifyRDP,
        smoothCatmullRom,
        smoothStroke,
        checkSnapClose,
        erasePointsFromStroke,
        resamplePoints,
        round
    };
})();
