# EpiArt

EpiArt is a browser-based harmonic drawing and reconstruction studio for creating stylized vector artwork from hand-drawn strokes. It combines a drawing canvas with a Fourier-inspired reconstruction view that animates epicycle motion, helping artists sketch, refine, and re-render drawings as expressive harmonic traces.

This project is a single-page frontend built with plain HTML, CSS, and JavaScript. It is designed as a lightweight creative tool for experimentation, figure studies, and generative motion art without requiring a build step or external framework.

## Highlights

- Freehand drawing with pen and eraser tools
- Symmetry modes for mirrored composition
- Pan and zoom controls on both drawing and reconstruction views
- Layer-based stroke management with ordering, lock, visibility, recolor, duplicate, and delete actions
- Fourier-style harmonic analysis via DFT-based coefficient generation
- Epicycle reconstruction and animated playback of motion traces
- Preset scaffold tools for humanoid and structured figure drawing
- Reference image overlay support for tracing and composition
- Compression/export settings for simplified stroke payloads
- Local browser-first workflow with no backend required

## Project Goals

EpiArt is built around a simple idea: treat hand-drawn strokes as data, analyze their geometry with Fourier-inspired decomposition, then re-render them as animated harmonic paths. This creates a hybrid workflow between traditional sketching and computational art generation.

The interface is intentionally modular and transparent. Every drawing surface, stroke, and harmonic reconstruction is exposed via a state-driven JS architecture so it remains easy to extend with new tools, presets, and export formats.

## Features in Detail

### Drawing Studio

- Draw strokes with adjustable color and brush width
- Use an eraser with radius-based point removal
- Toggle guides and ruler overlays for proportion studies
- Support reference image placement and opacity controls
- Use symmetry axis locks for vertical or horizontal mirroring

### Reconstruction Studio

- Rebuild hand-drawn strokes as epicycle chains
- Animate motion using playback controls and playback speed adjustment
- Show or hide reference overlays and harmonic trails
- Zoom and pan the harmonic reconstruction area independently
- Balance term count vs. visual fidelity with the epicycle budget

### Stroke Management

- Layer list with drag-to-reorder behavior
- Per-stroke name editing
- Per-stroke epicycle override controls
- Lock and hide functionality for scene organization
- Duplicate strokes with offset or mirror behavior

### Data & Export

- Compute stroke coefficients from normalized, resampled points
- Estimate payload size for compressed outputs
- Export a compact EPI-style JSON representation for use with the project’s reconstruction logic

## Tech Stack

- HTML5 canvas rendering
- CSS for dark studio UI
- Vanilla JavaScript modules loaded in the browser
- No build pipeline required

## Repository Structure

```text
.
├── engine.js
├── index.html
├── js/
│   ├── drawing.js
│   ├── math.js
│   ├── recon.js
│   ├── state.js
│   ├── ui.js
│   └── utils.js
├── README.md
└── .gitignore (if present in your checkout)
```

## Run Locally

Because this project is a static browser app, you can run it in several simple ways.

### Option 1: Open directly

Open `index.html` in a browser.

### Option 2: Serve with a local web server

From the project root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## How to Use

1. Open the app in a browser.
2. Use the left panel to choose a brush color, brush size, and drawing tool.
3. Draw strokes on the left canvas.
4. The harmonic reconstruction view on the right updates live as strokes are processed.
5. Use layers, symmetry, guides, and presets to build more structured compositions.
6. Adjust epicycle term count and playback settings to tune the motion and visual result.
7. Export or compress the composition when ready.

## Understanding the Workflow

The app follows a workflow that mirrors a creative sketch-to-animated-render pipeline:

- Draw a stroke on the input canvas
- Smooth and resample the path points
- Compute Fourier-style coefficients
- Reconstruct the shape by evaluating the harmonic terms
- Animate the chain along a time parameter for motion rendering

This gives each stroke a compressed mathematical representation that can be rendered, recombined, and manipulated in the reconstruction canvas.

## Notes

- The project is currently front-end only and runs entirely in the browser.
- The app uses browser local state and real-time canvas operations; no user data is stored externally.
- Some features depend on modern browser canvas support.

## Future Ideas

Potential next improvements include:

- Import/export of full project files
- PNG or SVG snapshot rendering
- Better brush realism and pressure simulation
- More advanced symmetry and transformation tools
- Reusable preset libraries
- Undo/redo history improvements across all UI actions

## Contributing

Contributions are welcome. If you are improving the drawing engine, UI, or harmonic reconstruction logic, consider keeping changes focused and well-documented.

## Contact

Project repository: https://github.com/ValijonJumaboyev/epiart

## Disclaimer

This project is provided as-is for creative exploration and artistic prototyping. It is not a production-grade commercial graphics engine, but it is intentionally structured to be easy to understand, extend, and learn from.

## Project link
https://epiart.netlify.app/
