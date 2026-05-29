# Dataflow Visualiser

> **⚠️ This project is currently under active development.**

A high-performance native desktop tool for indexing, visualizing, and analyzing local codebases — with AI-powered blast-radius simulation and full privacy control.

![TypeScript](https://img.shields.io/badge/TypeScript-64%25-3178C6?style=flat&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-32%25-CE422B?style=flat&logo=rust&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![Status](https://img.shields.io/badge/Status-Active%20Development-orange?style=flat)

---

## The Problem

Developers working on large, unfamiliar, or legacy codebases have no fast way to answer *"if I touch this file, what breaks?"* before they touch it. Existing tools are either too slow, cloud-locked, produce static output, or require vendor lock-in to work at all.

---

## What Dataflow Visualiser Does

Dataflow Visualiser turns your local codebase into a **live, interactive dependency graph** — then lets you simulate structural changes and instantly see the propagation path before a single line of code is touched.

- **Native-speed AST parsing** via `oxc-parser` in Rust — scans thousands of files per second without blocking the main thread.
- **Interactive spatial canvas** — force-directed graph in both 2D and 3D with directory-based clustering, dynamic edge weight/opacity scaled to import frequency.
- **Blast-radius simulation** — select any node, simulate a refactor, and watch the downstream impact color-code from Deep Red (immediate breaking risk) to Light Orange (type adjustment required).
- **AI-Powered Code Mapping** — integrates with the Google Gemini API to automatically group files into semantic domains and generate concise descriptions.
- **Smart edge routing** — dynamic handle selection (top/bottom/left/right) post-Dagre layout for clean bezier curves with no looping artifacts.
- **Data flow directionality** — blue edges for incoming data, green for outgoing, with matching arrowheads.

---

## Architecture

The application is strictly separated into a sandboxed UI layer and a native systems engine, communicating over a low-latency IPC bridge.

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Canvas manipulation, graph rendering, UI state |
| **Styling** | TailwindCSS 4 | Dark micro-IDE aesthetic |
| **Backend** | Rust + Tauri v2 | File system I/O, AST parsing, AI orchestration |
| **Graph Layout** | `@xyflow/react` + `dagre` | Node/edge rendering and hierarchical layout |
| **Parsing** | `oxc-parser` (Rust) | Ultra-fast JS/TS AST tokenizing |
| **AI Engine** | Google Gemini API | Dynamic semantic domain grouping & file descriptions |

### Data Flow

```
User selects repo
       ↓
Rust backend (oxc-parser) indexes files & builds dependency graph
       ↓
Tauri IPC → React frontend renders interactive canvas
       ↓
User selects node → blast-radius traversal runs downstream DFS
       ↓
AI analysis request → Rust formulates prompt with local code context
       ↓
Google Gemini API → response returned to frontend to enrich graph
```

---

## Repository Structure

```text
Dataflow-Visualiser/
├── src-tauri/                    # Rust Backend Engine
│   ├── src/
│   │   ├── ai.rs                 # Gemini AI integration for blast-radius & semantic grouping
│   │   ├── commands.rs           # Basic utility commands (delete, open in IDE)
│   │   ├── git.rs                # Git operations (history, diffs, staging, commits)
│   │   ├── lib.rs                # Tauri application setup and command registration
│   │   ├── pty.rs                # Interactive terminal integration via portable-pty
│   │   ├── refactor.rs           # Refactor impact preview
│   │   ├── snapshots.rs          # Snapshot save, list, and diff
│   │   ├── state.rs              # Shared application state
│   │   └── parser/               # AST parsing engine
│   │       ├── mod.rs            # Orchestration: file walking & dispatch
│   │       ├── graph_builder.rs  # Edge resolution, barrel flattening, CMake & API wiring
│   │       ├── unused_exports.rs # Unused export annotation
│   │       ├── javascript.rs     # oxc-parser JS/TS ingestion + dynamic import/require
│   │       ├── nextjs.rs         # Next.js routing & layout implicit edges
│   │       ├── python.rs         # Python import extraction
│   │       ├── rust.rs           # Rust module resolution
│   │       ├── dart.rs           # Dart package resolution
│   │       ├── cmake.rs          # CMake component dependency parsing
│   │       ├── cpp.rs            # C/C++ include extraction
│   │       ├── props.rs          # React prop trace command
│   │       ├── tree_sitter_utils.rs # tree-sitter helpers
│   │       └── utils.rs          # Import path resolution & alias handling
│   ├── Cargo.toml                # Rust dependencies
│   └── build.rs                  # Tauri build script
├── src/                          # React Frontend
│   ├── hooks/                    # Business logic hooks
│   │   ├── useSettings.ts        # API key, theme, IDE settings persistence
│   │   ├── useProjectLoader.ts   # Directory selection, parsing, AI enrichment, watchers
│   │   └── useGraphLayout.ts     # Dagre layout computation & AI enrichment merge
│   ├── components/
│   │   ├── graph/                # Canvas nodes and edges
│   │   │   ├── FileNode.tsx      # File + external dependency node renderer
│   │   │   ├── ReactFlowGraph.tsx# 2D flow canvas
│   │   │   ├── ThreeDGraph.tsx   # 3D force-directed canvas
│   │   │   └── ...               # Legend, layout controls
│   │   └── layout/               # IDE chrome
│   │       ├── panels/           # BottomPanel sub-panels
│   │       │   ├── InspectorPanel.tsx  # Node metadata, prop tracer, dependency list
│   │       │   └── MatrixPanel.tsx     # Adjacency matrix view
│   │       ├── BottomPanel.tsx   # Resizable panel shell with tab routing
│   │       ├── Header.tsx        # Top toolbar (view mode, layers, toggles)
│   │       ├── SettingsModal.tsx # API key, model, IDE configuration
│   │       ├── SourceControlPanel.tsx
│   │       └── ...               # Other layout components
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── App.tsx                   # Root composition
│   └── utils/                    # Pure utility functions
│       ├── layout.ts             # Dagre + external dep placement
│       ├── cycleDetection.ts     # Circular dependency DFS
│       └── blastRadius.ts        # Blast radius traversal
├── package.json                  # Node.js dependencies and scripts
└── vite.config.ts                # Vite build configuration
```

---

## Key Features

### Multi-Language AST Ingestion
- **JS/TS**: Uses `oxc-parser` in Rust for native-speed ingestion (10–50× faster than Node-based parsers), extracting exact imported variables, resolving dynamic `import()` and `require()` calls, and distinguishing between data sources vs sinks.
- **Python, Rust, Dart, C, & C++**: Leverages `tree-sitter` for rapid dependency extraction across primary backend, mobile, and embedded languages. Supports smart resolution of `pubspec.yaml`, Rust module hierarchies, and complex `#include` parsing for embedded frameworks like ESP-IDF.

### Interactive Spatial Canvas
- **Directory-Based Bounding Box Clustering** — files grouped visually by folder hierarchy.
- **WebGL-Powered 3D Canvas** — switch seamlessly to a fully interactive 3D force-directed node web for complete spatial exploration.
- **Next.js Architecture Awareness** — automatically infers implicit routing dependencies (connecting `layout.tsx` to nested `page.tsx`) and collapses noisy API routes to clean up the graph.
- **Contextual Node Actions** — right-click any node to instantly open the file in your preferred editor or delete it from the codebase.
- **Edge Weight & Opacity** — scaled to actual import frequency from AST data.
- **Smart Dynamic Handle Routing** — post-Dagre layout resolves bezier handle direction per edge to eliminate crossing lines.
- **Color-Coded Directionality** — blue (incoming), green (outgoing) with matching arrowheads.

### Predictive Blast-Radius Analytics
Select any node and simulate a structural change. The engine traces dependencies downstream, color-coding files from **Deep Red** (immediate breaking risk) to **Light Orange** (type definition adjustment required) — before you've changed a single line.

### Advanced Codebase Analysis
- **Dead Code Detection** — instantly identifies orphaned files and flags unused exports across your entire workspace, helping you safely prune legacy code.
- **Circular Dependency Detection** — automatically detects and highlights import cycles via Depth First Search, mapping out circular paths in bright rose.
- **Component Prop Tracing** — track specific React/JSX props down the component tree to visualize and debug prop-drilling patterns.
- **External Dependency Mapping & Pruning** — surfaces third-party `npm` and `pub` packages as distinct pill-shaped nodes natively decoupled from the main grid to map them with the shortest possible connections. The engine automatically filters out zero-connection default tooling (like `eslint` or `typescript`) to prevent canvas clutter, while actively flagging genuinely unused project packages with a striking red `UNUSED` badge so you can safely prune your `package.json`.
- **Complexity Heatmap** — visually maps code complexity (such as function density, import counts, and file sizes) across nodes using a color gradient, enabling developers to instantly locate maintainability hotspots and risky refactor targets.
- **Fuzzy Search & Filter** — quickly navigate massive codebases with a real-time search bar that highlights matching nodes and collapses irrelevant subtrees.
- **Barrel File Flattening** — automatically bypasses exclusively re-exporting modules (`index.ts` proxies) to prevent graph congestion, pointing directly to the underlying component source.
- **Snapshot Diffing** — save snapshots of your entire graph state to a local SQLite journal, and visually diff them (Base vs Target) to highlight added and removed nodes/edges in bright emerald and rose.
- **Symbol-Level Drill-Down** — click to expand any file node directly on the canvas to inspect its exported functions, classes, and variables, complete with inline dead-code tracking.

### Interactive Command Palette
Press **`Ctrl+K`** (or **`Cmd+K`** on macOS) at any time to open the global **Command Palette** overlay. Fully keyboard-driven, it lets you:
- Quickly switch projects/directories.
- Toggle between **Dark Mode** and **Light Mode**.
- Toggle layout overlays like the **Minimap** or **External Dependencies**.
- Instantly filter the canvas to isolate the **UI Layer**, the **Backend Layer**, or view **Overall**.
- Open Settings and configure integrations.

### Deep IDE Integration
Configure your preferred development tool in the settings panel to quickly open any file with a right-click. Supported IDEs include:
- **VS Code** (`code`)
- **Cursor** (`cursor`)
- **IntelliJ IDEA** (`idea`)
- **WebStorm** (`webstorm`)
- **Neovim** (`nvim`)

### Recent Projects Dashboard
Never lose your place. The home screen features a chronological list of recent workspaces, displaying project names and parent folders for easy, single-click restoration of your layout.

### Beautiful Dual-Theme Engine
Crafted with a sleek, dark micro-IDE aesthetic by default. Features complete support for a crisp, high-contrast **Light Mode** that shifts all canvas components, headers, panels, and borders to light styling without sacrificing design premiumness.

### Google Gemini AI Engine
- **Dynamic Model Discovery** — input your Gemini API Key to dynamically fetch available generative models directly from Google's endpoint (including `gemini-1.5-flash`).
- **Connection Testing** — built-in API connectivity test and feedback to quickly verify your credentials.
- **Automated Summary & Domain Mapping** — once enabled, the backend reads file context in chunks to assign descriptive semantic domains and precise 1-2 sentence explanations, rendering them directly in the inspector panels.

### Native OS Security & Capabilities
- **Strict Capability Auditing** — Rust backend operations explicitly enforce the Tauri `fs_scope()`. Even when circumventing frontend layers, the execution sandbox rejects access to files not explicitly authorized by the native OS directory picker.

### Interactive Git Integration
- **Full History Timeline** — View commit history directly in a bottom panel.
- **Diff Viewer Modal** — Click any commit to view a dedicated modal showing exact, line-by-line diffs per changed file.
- **Staging & Commits** — Stage, unstage, and commit files without leaving the application.

### Integrated PTY Terminal
- Built-in, resizable interactive terminal powered by `portable-pty`.
- Run commands, start dev servers, or use standard CLI tools in the same window as your graph.

---

## Supported Frameworks

Dataflow Visualiser is designed to be language and framework agnostic, but includes dedicated smart-resolution logic for the following architectures:

- **Web & Full-Stack**: `Next.js` (App/Pages router mapping & API route collapsing), `React`, `Vue`, `Svelte` (via universal JS/TS AST parsing).
- **Systems & Backend**: `Rust` (Cargo workspace resolution), `Python` (FastAPI, Django, Flask).
- **Mobile Applications**: `Flutter / Dart` (automatic `pubspec.yaml` package mapping).
- **Embedded & IoT**: `ESP-IDF` (C/C++ `#include` resolution bypassing complex CMake configurations).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS 4
- **Graph**: `@xyflow/react` v12, `dagre`, WebGL / Three.js
- **Backend**: Rust, Tauri v2
- **Parsing**: `oxc-parser`
- **AI**: Google Gemini API (with dynamic model list retrieval)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

### Running Locally

```bash
# Clone the repository
git clone https://github.com/Stewy8506/Dataflow-Visualiser.git
cd Dataflow-Visualiser

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Building for Production

```bash
npm run tauri build
```

---

## Roadmap

- [x] `notify` crate — live filesystem watcher with incremental re-parse on save
- [x] `tsconfig.json` paths alias resolution (`@/components/X` imports)
- [x] Static complexity metrics extraction (function & import counts) and UI badges
- [x] Barrel export flattening (`index.ts` bypass)
- [x] Uncommitted change detection and live Git status panel
- [x] Full Git History timeline and file diff visualizer
- [x] Integrated PTY terminal inside a resizable bottom pane
- [x] Fuzzy search/filter bar with canvas highlight and collapse
- [x] Mini-map overlay for large codebases
- [x] Monorepo / multi-root workspace support
- [x] Dead code detection (orphaned nodes and unused exports)
- [x] Circular dependency detection and highlighting
- [x] External dependency mapping and wasted import flagging
- [x] Refactor impact preview (exact file list and line change estimates)
- [x] Component prop tracing across React/JSX hierarchies
- [x] Snapshot diffing and version drifting visualization
- [x] Symbol-level drill-down inside file nodes
- [x] Google Gemini AI integration, dynamic model fetching, and settings connection
- [x] Resizable bottom pane shell with tab routing and matrix visualization
- [x] Global keyboard-driven Command Palette (`Ctrl+K`)
- [x] Configurable IDE editor launcher in settings (VS Code, Cursor, WebStorm, IntelliJ, Neovim)
- [x] Light Mode and Dark Mode support
- [x] Welcome dashboard with Recent Projects listing
- [ ] Persistent node layout across sessions
- [ ] `git2` crate — file churn overlay (volatility heatmap on nodes)
- [ ] PNG canvas export
- [ ] JSON dependency graph export for CI diffing

---

## Why Not Just Use X?

| Tool | What It Does | What It Misses |
| :--- | :--- | :--- |
| **Dependency Cruiser** | CLI dep graph, rule-based | No interactive canvas, no AI, no live watch |
| **Madge** | Circular dep detection | Terminal output only |
| **CodeSee** | Cloud codebase maps | Sends your code to their servers |
| **Cursor / Copilot** | In-editor AI suggestions | No whole-graph structural view |
| **Nx Graph** | Monorepo visual dep graph | Only works within Nx workspaces, no AI |

Dataflow Visualiser is the only tool that combines **native-speed local parsing**, **interactive blast-radius simulation**, and **privacy-first AI** in a single desktop application.

---

## License

MIT — see [LICENSE](LICENSE) for details.


