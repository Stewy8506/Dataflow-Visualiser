# Dataflow Visualiser

> **⚠️ This project is currently under active development.**

A high-performance native desktop tool for indexing, visualizing, and analyzing local codebases — with AI-powered blast-radius simulation and full privacy control.

![TypeScript](https://img.shields.io/badge/TypeScript-75.7%25-3178C6?style=flat&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-23.5%25-CE422B?style=flat&logo=rust&logoColor=white)
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

## Key Features

### Blazing Fast AST Ingestion
`oxc-parser` runs natively in Rust off the main thread — 10–50× faster than Node-based parsers. Extracts exact imported variable names, detects data sources (hooks/function calls) vs data sinks (JSX tags), and builds a precise dependency graph per file.

### Interactive Spatial Canvas
- Directory-based bounding box clustering — files grouped visually by folder hierarchy
- Edge weight and opacity scaled to actual import frequency from AST data
- Smart dynamic handle routing — post-Dagre layout resolves bezier handle direction per edge
- Color-coded directionality — blue (incoming), green (outgoing) with matching arrowheads

### Predictive Blast-Radius Analytics
Select any node and simulate a structural change. The engine traces dependencies downstream, color-coding files from **Deep Red** (immediate breaking risk) to **Light Orange** (type definition adjustment required) — before you've changed a single line.

### Privacy-First AI Toggle
- **Ollama mode** — fully air-gapped, all analysis on-machine. Zero proprietary code leaves the device. Suitable for enterprise, fintech, and defence environments
- **Anthropic Cloud mode** — deep macro-architectural analysis for complex refactoring decisions
- Single toggle, shared prompt interface, swappable transport

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

- [ ] `notify` crate — live filesystem watcher with incremental re-parse on save
- [ ] `tsconfig.json` paths alias resolution (`@/components/X` imports)
- [ ] Monorepo / multi-root workspace support
- [ ] Fuzzy search/filter bar with canvas highlight and collapse
- [ ] Mini-map overlay for large codebases
- [ ] Persistent node layout across sessions
- [ ] Ollama + Anthropic AI panel UI
- [ ] `git2` crate — file churn overlay (volatility heatmap on nodes)
- [ ] Uncommitted change detection — live flag on actively modified nodes
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
