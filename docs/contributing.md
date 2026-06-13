# Developer Contribution Guide

Thank you for helping build Dataflow Visualiser! This document covers setup instructions, architecture standards, and contribution processes.

---

## 1. Quick Start Development Setup

### Prerequisites
*   **Node.js**: v18.0.0 or higher.
*   **Rust**: Stable toolchain (install via [rustup](https://rustup.rs/)).
*   **Tauri OS Requirements**: Follow the [Tauri Setup Guide](https://tauri.app/start/prerequisites/) for your operating system (requires C++ build tools, `webkit2gtk` dependencies on Linux, etc.).

### Build Commands
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Stewy8506/Dataflow-Visualiser.git
    cd Dataflow-Visualiser
    ```
2.  **Install Frontend Dependencies**:
    ```bash
    npm install
    ```
3.  **Run Development Server**:
    This spins up the Vite local server and launches the native Tauri desktop window:
    ```bash
    npm run tauri dev
    ```
4.  **Run Frontend Linting**:
    ```bash
    npm run lint
    ```
5.  **Run Tests**:
    ```bash
    npm run test
    ```

---

## 2. Codebase Conventions

### Frontend Layer (`/frontend`)
*   **State Management**: Store states inside unified Zustand wrappers. Use shallow hooks (`useShallow`) to pull specific parameters, avoiding re-renders.
*   **Styling**: Use TailwindCSS v4 variables. Accent colors should inherit dynamic theme settings.
*   **Components**: Keep layout components modular, separating rendering shells from core logic.

### Core Backend (`/src-tauri`)
*   **Safety**: Ensure all file operations evaluate path targets against the active workspace boundary to prevent traversal issues.
*   **Concurrency**: Avoid locking the main thread. Delegate directory crawling and parsing steps to Rayon thread-pools.
*   **IPC commands**: Register all commands inside [lib.rs](file:///c:/Users/dasan/Documents/Dataflow-Visualiser/src-tauri/src/lib.rs).

---

## 3. Extending Language Support

To add parsing capability for a new language:
1.  Open the backend parser directory: `/src-tauri/src/parser/languages/`.
2.  Create a new parser file (e.g. `go.rs` or `cpp.rs`).
3.  Implement AST traversal using a tree-sitter language grammar.
4.  Register the module inside `mod.rs` and update the file extension resolver to map targets to your new language parser.
