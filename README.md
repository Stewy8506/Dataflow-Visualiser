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

- **Native-speed AST parsing** via `oxc-parser` in Rust — scans thousands of files per second without blocking the main thread
- **Interactive spatial canvas** — force-directed graph with directory-based clustering, dynamic edge weight/opacity scaled to import frequency
- **Blast-radius simulation** — select any node, simulate a refactor, and watch the downstream impact color-code from Deep Red (immediate breaking risk) to Light Orange (type adjustment required)
- **Privacy-first AI** — toggle between fully offline Ollama (zero data leaves your machine) and Anthropic Cloud for deep architectural analysis
- **Smart edge routing** — dynamic handle selection (top/bottom/left/right) post-Dagre layout for clean bezier curves with no looping artifacts
- **Data flow directionality** — blue edges for incoming data, green for outgoing, with matching arrowheads

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
| **AI — Local** | Ollama | Fully offline, privacy-compliant analysis |
| **AI — Cloud** | Anthropic API | Deep macro-architectural refactoring assessments |

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
Ollama (local) or Anthropic (cloud) → response streamed back to UI
```

---

## Repository Structure

```text
Dataflow-Visualiser/
├── src-tauri/             # Rust Backend Engine
│   ├── src/
│   │   ├── ai.rs          # Gemini AI integration for blast-radius & semantic grouping
│   │   ├── commands.rs    # Basic utility commands (delete, open in IDE)
│   │   ├── git.rs         # Git operations (history, diffs, staging, commits)
│   │   ├── lib.rs         # Tauri application setup and command registration
│   │   ├── parser.rs      # AST parsing, monorepo alias resolution, and edge building
│   │   ├── pty.rs         # Interactive terminal integration via portable-pty
│   │   └── state.rs       # Shared application state
│   ├── Cargo.toml         # Rust dependencies
│   └── build.rs           # Tauri build script
├── src/                   # React Frontend
│   ├── components/        # UI components
│   │   ├── graph/         # Nodes, edges, controls, and mini-map
│   │   ├── layout/        # Main panels (Terminal, Source Control, Sidebars)
│   │   └── ...            # Other shared UI elements
│   ├── App.tsx            # Main application layout and state management
│   └── main.tsx           # React DOM render entry
├── package.json           # Node.js dependencies and scripts
└── vite.config.ts         # Vite build configuration
```

---

## Key Features

### Multi-Language AST Ingestion
- **JS/TS**: Uses `oxc-parser` in Rust for native-speed ingestion (10–50× faster than Node-based parsers), extracting exact imported variables and distinguishing between data sources vs sinks.
- **Python, Rust, Dart, C, & C++**: Leverages `tree-sitter` for rapid dependency extraction across primary backend, mobile, and embedded languages. Supports smart resolution of `pubspec.yaml`, Rust module hierarchies, and complex `#include` parsing for embedded frameworks like ESP-IDF.

### Interactive Spatial Canvas
- Directory-based bounding box clustering — files grouped visually by folder hierarchy
- **Next.js Architecture Awareness** — automatically infers implicit routing dependencies (connecting `layout.tsx` to nested `page.tsx`) and collapses noisy API routes to clean up the graph.
- **Contextual Node Actions** — right-click any node to instantly open the file in your default IDE or delete it from the codebase.
- Edge weight and opacity scaled to actual import frequency from AST data
- Smart dynamic handle routing — post-Dagre layout resolves bezier handle direction per edge
- Color-coded directionality — blue (incoming), green (outgoing) with matching arrowheads

### Predictive Blast-Radius Analytics
Select any node and simulate a structural change. The engine traces dependencies downstream, color-coding files from **Deep Red** (immediate breaking risk) to **Light Orange** (type definition adjustment required) — before you've changed a single line.

### Advanced Codebase Analysis
- **Dead Code Detection** — instantly identifies orphaned files and flags unused exports across your entire workspace, helping you safely prune legacy code.
- **Complexity Heatmap** — visually maps code complexity (such as function density, import counts, and file sizes) across nodes using a color gradient, enabling developers to instantly locate maintainability hotspots and risky refactor targets.
- **Fuzzy Search & Filter** — quickly navigate massive codebases with a real-time search bar that highlights matching nodes and collapses irrelevant subtrees.
- **Barrel File Flattening** — automatically bypasses exclusively re-exporting modules (`index.ts` proxies) to prevent graph congestion, pointing directly to the underlying component source.

### Native OS Security & Capabilities
- **Strict Capability Auditing** — Rust backend operations explicitly enforce the Tauri `fs_scope()`. Even when circumventing frontend layers, the execution sandbox rejects access to files not explicitly authorized by the native OS directory picker.

### Interactive Git Integration
- **Full History Timeline** — View commit history directly in a bottom panel.
- **Diff Viewer Modal** — Click any commit to view a dedicated modal showing exact, line-by-line diffs per changed file.
- **Staging & Commits** — Stage, unstage, and commit files without leaving the application.

### Integrated PTY Terminal
- Built-in, resizable interactive terminal powered by `portable-pty`.
- Run commands, start dev servers, or use standard CLI tools in the same window as your graph.

### Privacy-First AI Toggle
- **Ollama mode** — fully air-gapped, all analysis on-machine. Zero proprietary code leaves the device. Suitable for enterprise, fintech, and defence environments
- **Anthropic Cloud mode** — deep macro-architectural analysis for complex refactoring decisions
- Single toggle, shared prompt interface, swappable transport

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
- **Graph**: `@xyflow/react` v12, `dagre`
- **Backend**: Rust, Tauri v2
- **Parsing**: `oxc-parser`
- **AI**: Ollama (local), Anthropic API (cloud)

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
- [ ] Persistent node layout across sessions
- [ ] Ollama + Anthropic AI panel UI
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
