# Dataflow Visualiser

> **⚠️ Note: This project is currently under active development.**

Dataflow Visualiser is a high-performance desktop application designed to function as an advanced developer tool for indexing, visualizing, and analyzing local codebases. 

Built with **Tauri v2**, **Rust**, and **React**, it focuses on native performance, privacy, and providing a highly responsive user interface for large-scale code analysis.

## 🌟 Key Features (Planned & In Progress)

- **Local Codebase Indexing**: Utilizes `oxc-parser` for extremely fast parsing and indexing of your local projects.
- **Code Structure Visualization**: Generates intuitive dependency graphs and visual representations of your codebase architecture.
- **AI-Powered Analysis**: Integrates with local AI models (via Ollama) or cloud-based APIs (like Anthropic) to provide intelligent insights, explain code, and suggest improvements without compromising privacy.
- **Privacy First**: All local indexing stays on your machine. You control what data, if any, is sent to external APIs.
- **High Performance**: Leverages Rust's speed for heavy lifting (parsing, indexing) and React for a smooth, modern UI.

## 🚀 Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend / Core**: Rust, Tauri v2
- **Parsing**: `oxc-parser`
- **AI Integration**: Ollama (Local), Anthropic API (Cloud)

## 🛠️ Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) 
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 📦 Running Locally

Since the project is under active development, these instructions may evolve over time.

1. **Prerequisites**: Make sure you have Node.js and Rust installed on your machine.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the development server**:
   ```bash
   npm run tauri dev
   ```

## 📝 License

This project is open source and available under the MIT License.
