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
│   │       ├── core/             # Core models & graph construction
│   │       │   ├── graph_builder.rs
│   │       │   └── models.rs
│   │       ├── languages/        # Language-specific AST extractors
│   │       │   ├── javascript.rs # oxc-parser JS/TS ingestion + dynamic imports
│   │       │   ├── rust.rs       # Rust module resolution
│   │       │   ├── python.rs     # Python import extraction
│   │       │   └── ...           # (cpp, csharp, go, java, dart, cmake, nextjs)
│   │       └── utils/            # Analyzers and resolution helpers
│   │           ├── alias.rs      # TypeScript path alias resolution
│   │           ├── osv.rs        # Vulnerability lookups via OSV API
│   │           ├── props.rs      # React prop trace command
│   │           ├── unused_exports.rs # Unused export annotation
│   │           └── tree_sitter_utils.rs
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
│   │   └── layout/               # IDE chrome layout structure
│   │       ├── BottomPanel.tsx   # Resizable panel shell with tab routing
│   │       ├── Header.tsx        # Top toolbar (view mode, layers, toggles)
│   │       └── ...               # Sidebar, WorkspaceBreadcrumb, etc.
│   ├── features/                 # Modular application features
│   │   ├── explorer/             # File explorer & workspace tree
│   │   ├── inspector/            # Detailed file & symbol inspection
│   │   ├── matrix/               # Adjacency matrix visualization
│   │   ├── refactor/             # Blast-radius refactoring impact preview
│   │   ├── search/               # Global search & Command Palette (Ctrl+K)
│   │   ├── settings/             # User settings & API configurations
│   │   ├── snapshots/            # SQLite graph snapshotting & diffing
│   │   ├── source-control/       # Stage, diff, commit changes
│   │   └── terminal/             # Integrated PTY terminal
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
- **Persistent Layout Storage** — securely saves custom node drag positions to `localStorage` seamlessly bridging between automated layout and manual curation.
- **High-Quality PNG Export** — export the interactive graph directly to a clean, transparent PNG image file.
- **Architectural Mapping:** Visualizes codebases with a layout algorithm powered by Dagre and optimized with Web Workers for large repositories.
- **AI Codebase Assistant:** Interactive Gemini-powered floating chat to ask questions about specific files or the entire repository.
- **Dynamic File Filtering:** Exclude specific directories, extensions, or tests/mocks dynamically.
- **Performance Optimized:** Uses native Rust parsing (Tree-Sitter + Rayon), Web Workers for layout, and Zustand for frontend state.

### Predictive Blast-Radius Analytics
Select any node and simulate a structural change. The engine traces dependencies downstream, color-coding files from **Deep Red** (immediate breaking risk) to **Light Orange** (type definition adjustment required) — before you've changed a single line.
- **AI-Powered Executable Refactoring** — You can now seamlessly execute the refactoring preview. The Google Gemini API will directly rewrite the affected files and save them to your local disk, instantly applying the necessary codebase updates.

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
- **Dependency Version Risk (CVE/OSV)** — Cross-references your external dependencies against the `osv.dev` vulnerability database by parsing lockfiles (`package-lock.json`, `pubspec.lock`), flagging vulnerable packages with critical CVE badges.
- **Dependency Health Score** — Calculates a composite health grade (A-F) for every file based on structural metrics: coupling (out-edges), blast-radius (in-edges), and internal code complexity.
- **Git Churn Heatmap Overlay** — analyzes up to the last 100 commits to paint the graph with a red/orange volatility heatmap, letting you instantly spot highly modified, bug-prone components.
- **Headless CI Dependency Export** — invoke the binary via the CLI (`--export-graph`) to silently parse the project and dump a deterministic JSON graph snapshot for PR diffing in GitHub Actions.

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

### 🧠 Deep AI Engine (Cloud & Local)
Dataflow Visualiser features a genuinely deep AI integration, utilizing it for **three distinct, high-impact jobs**:

1. **Automated Semantic Domain Mapping** — The backend reads file context in chunks to automatically assign descriptive semantic domains and precise 1-2 sentence explanations to every file in your graph, making unfamiliar codebases instantly readable.
2. **Executable Refactoring** — Preview structural changes and have the AI directly rewrite the affected files, saving them to your local disk and instantly applying the necessary codebase updates.
3. **Interactive File-Scoped Q&A** — A floating AI Chat Assistant is docked over your canvas. Click "Ask AI" on any node to instantly inject that specific file as context, allowing you to interrogate the exact implementation details of a single component without losing your place in the graph.

- **Dynamic Model Discovery & Testing** — input your Gemini API Key to dynamically fetch available generative models directly from Google's endpoint (including `gemini-1.5-flash`) and quickly verify your credentials with built-in connectivity tests.
- **Local AI Provider Support** — Total privacy mode. Point the engine to any local, OpenAI-compatible API endpoint (like **LMStudio**, **Ollama**, or **vLLM**) to run domain mapping, executable refactoring, and code Q&A entirely on your own hardware without sending code to the cloud.

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

### 🚀 Fully Shipped
- **Web & Full-Stack**: `Angular` (NgModule/decorator resolution), `Next.js` (App/Pages router mapping & API route collapsing), `React`, `Vue`, `Svelte` (via universal JS/TS AST parsing).
- **Node.js & Backend Frameworks**: `NestJS` (controller/service/module wiring), `Express.js` (router/middleware chain awareness).

### 🚧 Half-Working (Basic Parsing)
- **Systems & Native**: `Rust` (Cargo workspace resolution & basic module mapping), `Python` (basic import & FastAPI/Flask endpoint extraction).
- **Mobile Applications**: `Flutter / Dart` (basic Dart imports & automatic `pubspec.yaml` package mapping).
- **Embedded & IoT**: `ESP-IDF` (C/C++ `#include` resolution bypassing complex CMake configurations).
- **Enterprise & Backend**: `Java`, `C#`, `Go` (basic import extraction via tree-sitter bindings).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS 4
- **Graph**: `@xyflow/react` v12, `dagre`, WebGL / Three.js
- **Backend**: Rust, Tauri v2
- **Parsing**: `oxc-parser`, `tree-sitter`
- **AI**: Google Gemini API & Local LLMs (OpenAI-compatible endpoints)

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
- [x] AI-Powered Executable Refactoring via Gemini
- [x] Component prop tracing across React/JSX hierarchies
- [x] Snapshot diffing and version drifting visualization
- [x] Symbol-level drill-down inside file nodes
- [x] Google Gemini AI integration, dynamic model fetching, and settings connection
- [x] Resizable bottom pane shell with tab routing and matrix visualization
- [x] Global keyboard-driven Command Palette (`Ctrl+K`)
- [x] Configurable IDE editor launcher in settings (VS Code, Cursor, WebStorm, IntelliJ, Neovim)
- [x] Light Mode and Dark Mode support
- [x] Welcome dashboard with Recent Projects listing
- [x] Persistent node layout across sessions
- [x] `git2` crate — file churn overlay (volatility heatmap on nodes)
- [x] Advanced UI Graph Filtering (Hide Tests & Mocks)
- [x] PNG canvas export
- [x] JSON dependency graph export for CI diffing
- [x] Local AI Provider integration (LMStudio, Ollama)
- [x] Lockfile parsing (`package-lock.json`, `pubspec.lock`) & OSV Vulnerability cross-referencing
- [x] Dependency Health Scoring based on coupling, complexity, and blast-radius

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


