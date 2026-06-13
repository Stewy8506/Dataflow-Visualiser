# Project Roadmap & Future Milestones

This document details the development milestones and feature expansion plans for the Dataflow Visualiser ecosystem.

---

## Phase 1: Local Intelligence & Rich Context (Short-Term)

*   **Vector-Based Semantic Search**: Integrate a local vector database (e.g. `sqlite-vss` or Qdrant) to enable natural language searches (e.g., *"Find where we handle user authentication tokens"*).
*   **Monorepo & Multi-Root Support**: Enable indexing across separate projects or monorepo packages (e.g., Yarn Workspaces, Turborepo, Cargo Workspaces), resolving cross-package references.
*   **Git Live Visualization**: Animate the canvas in real-time as branches are switched or commits are checked out, showing code changes propagating.

---

## Phase 2: Extensibility & AI Architectures (Mid-Term)

*   **Plugin Hooks API**: Expose JavaScript/TypeScript API interfaces to let developers write custom AST parser hooks and register styling templates.
*   **AI-Generated Architecture Documents**: Automatically generate high-quality markdown files documenting codebase design updates on every commit, pushing documentation alongside pull requests.
*   **Collaborative Session Visualizer**: Enable team sync sessions where developers share a view of the canvas in real-time to walk through refactors.

---

## Phase 3: Enterprise Integration (Long-Term)

*   **Real-Time Active Tracking**: Run a lightweight background service that listens to filesystem edit events to incrementally update the spatial layout dynamically as you code.
*   **Continuous Integration Gatekeeper**: Embed a CLI tool into GitHub Actions that blocks PRs if they introduce circular dependencies or cause the blast-radius of a change to exceed a set threshold.
*   **Language Server Protocol (LSP) Bridges**: Hook directly into standard Language Servers to pull symbol cross-references, hover documentation, and diagnostics straight onto the canvas.
