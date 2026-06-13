# Spatial Graph & Layout Engine

Dataflow Visualiser relies on a spatial layout engine to render code architectures clearly, scaling from micro-repositories to multi-million-line codebases.

---

## 1. Hybrid Rendering Pipelines

The platform includes two distinct rendering pipelines, selectable dynamically in the workspace header:

### 2D React Flow View
*   **Engine**: Built on [@xyflow/react](file:///c:/Users/dasan/Documents/Dataflow-Visualiser/package.json).
*   **Nodes**: Renders rich custom React components (representing folders, files, utilities, and packages) with custom styling, edge handles, and click registers.
*   **Edges**: Optimized SVG paths with dynamic bezier control points. Edges are color-coded to represent directionality: **Blue** for incoming data references, and **Green** for outgoing exports.

### 3D Force-Directed WebGL View
*   **Engine**: Built on Three.js, `@react-three/fiber`, and `@react-three/drei`.
*   **Use Case**: Large codebases (e.g. VS Code codebase) containing thousands of nodes.
*   **Performance**: Utilizes GPU shaders to render nodes as WebGL spheres and connections as lines, maintaining **60 FPS** interactions when panning and rotating.

---

## 2. Layout & Worker Architecture

Computing layouts for a complex graph can easily freeze the main JavaScript UI thread. To solve this, the Dagre layout calculations are delegated to Web Workers:

```
┌─────────────────────────────────┐
│       React Main Thread         │
└───────────────┬─────────────────┘
                │ (Post Node/Edge Lists)
                ▼
┌─────────────────────────────────┐
│     Web Worker Thread           │
│  - Compute Dagre Layout         │
│  - Resolve Bounding Boxes       │
│  - Align Edge Handles           │
└───────────────┬─────────────────┘
                │ (Post Calculated X, Y Coordinates)
                ▼
┌─────────────────────────────────┐
│  React Flow Viewport Hydration  │
└─────────────────────────────────┘
```

*   **Dagre Layout**: Position nodes hierarchically, displaying top-down architectural cascades (e.g. pages importing components importing hooks).
*   **Bounding-Box Clustering**: Automatically draws boundaries around files residing in the same directory, forming visual folder clusters.
*   **Dynamic Handle Alignment**: Post-layout, a custom algorithm calculates the closest relative edges between parent and child nodes to route connectors through top, bottom, left, or right ports, preventing intersecting layout lines.

---

## 3. Styling & Micro-IDE Aesthetics

*   **Glassmorphic Overlay Panels**: Uses HSL-based color tokens with custom blur filters (`backdrop-blur`) to create panels that blend into the canvas grid.
*   **Custom Fonts**: Integrates Google Web Fonts (including Inter, Outfit, Roboto, Fira Code, and Source Code Pro).
*   **Graph Metrics Dashboard Overlay**: An overlay panel displaying:
    *   Total node counts and circular import paths.
    *   An SVG-based chart visualizing file language splits.
*   **Onboarding Animations**: Incorporates subtle animations powered by `framer-motion` to introduce nodes.
