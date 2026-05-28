# Architecture Overview

> **⚠️ Note: This documentation and the project are currently under active development.**

The **Dataflow Visualiser** is built on a modern, high-performance stack designed for analyzing large codebases natively and privately.

## High-Level Architecture

The application is structured into two main layers:

### 1. Frontend (React + TypeScript + Vite)
- Responsible for the UI layer and rendering the interactive dependency graphs.
- Communicates with the Rust backend via Tauri IPC commands.
- Designed for extreme responsiveness and smooth rendering of large, complex graphs.

### 2. Core Backend (Rust + Tauri v2)
- Handles all system-level operations, including reading the filesystem and parsing code.
- Uses `oxc-parser` for high-performance Abstract Syntax Tree (AST) generation.
- Manages local SQLite databases or in-memory caches for the codebase index.
- Orchestrates communication with local AI models (Ollama) or external APIs (Anthropic).

## Data Flow

1. **Indexing**: The user selects a local repository. The Rust backend uses `oxc-parser` to parse the codebase and extract dependencies, building an internal representation of the code structure.
2. **Visualization**: The structural data is sent to the React frontend via Tauri commands. The frontend renders this as an interactive graph or tree.
3. **AI Analysis**: When a user requests an explanation or analysis:
   - The React frontend sends a request to the Rust backend.
   - The Rust backend formulates a prompt, including the relevant code context (gathered locally).
   - The backend queries the configured AI provider (local Ollama instance or Anthropic API).
   - The response is streamed back through Rust to the React frontend for display.

## Privacy & Security

- **Local First**: Code indexing and parsing happen entirely on the user's machine.
- **Opt-in Cloud AI**: If cloud APIs are used, only the specific code snippets the user explicitly selects for analysis are sent to the API. Local models (Ollama) ensure zero data leaves the machine.
