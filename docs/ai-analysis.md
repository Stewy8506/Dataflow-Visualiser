# AI-Assisted Codebase Analysis

Dataflow Visualiser integrates artificial intelligence directly into the local workspace lifecycle, balancing cloud-based reasoning models with privacy-focused offline local LLMs.

---

## 1. Core Generative Capabilities

The system delegates three specific tasks to language models:

### 1. Automated Semantic Domain Mapping
When first indexing a project, the engine reads code summaries in batches to organize the spatial topology:
-   **Clustering**: Files are categorized into domain zones (e.g. `Data Fetching`, `UI Components`, `State Manager`, `Utilities`).
-   **Descriptions**: Synthesizes a 1-2 sentence semantic summary for each node.
-   **Implementation**: Done asynchronously in [ai.rs](file:///c:/Users/dasan/Documents/Dataflow-Visualiser/src-tauri/src/ai.rs), appending tags to the node metadata.

### 2. Executable Refactoring
Traces blast-radius nodes and proposes structural modifications:
-   **Action**: Rewrites code across multiple files (e.g. converting a component import to use a lazy load layout).
-   **Drafting**: Writes changes to disk in temporary files, which are loaded into the side-by-side Monaco diff panel for visual verification.

### 3. File-Scoped Floating Q&A
A floating helper widget is anchored directly over the node canvas:
-   **Context-Aware**: Selecting a node and clicking "Ask AI" injects the file's raw content directly as context.
-   **Saves Context**: Bypasses the need to upload the entire codebase by injecting only the active focus file and its immediate dependency signatures.

---

## 2. API Providers and Local LLMs

Dataflow Visualiser supports a wide array of AI backends, configurable in the settings registry:

```
                  ┌──────────────────────────────┐
                  │      AI Routing Engine       │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐    ┌──────────────────┐
│  Cloud Providers │   │ Multi-Model Hubs │    │  Local Offline   │
│  (Gemini, OpenAI,│   │  (OpenRouter)    │    │ (Ollama, LMStudio│
│   Claude)        │   │                  │    │  vLLM Local AP)  │
└──────────────────┘   └──────────────────┘    └──────────────────┘
```

*   **Google Gemini (Recommended)**: Utilizes `gemini-1.5-flash` or `gemini-2.5-pro` for native code comprehension, utilizing large context windows.
*   **OpenAI & Anthropic**: Fully compatible with `gpt-4o` and `claude-3-5-sonnet`.
*   **OpenRouter & Groq**: Supports high-speed inference endpoints.
*   **Local Privacy Mode (Ollama & LMStudio)**: Maps to local OpenAI-compatible endpoints running on your own GPU/CPU hardware. No code snippets ever leave your development machine.

---

## 3. Prompt Hydration & Context Limits

To optimize API usage and avoid rate limit blocks:
-   **Context Pruning**: The engine extracts only the active file's AST module signatures (types, exports, dependencies) rather than copying full file texts for third-party nodes.
-   **Caching**: Semantic descriptions are cached inside the local SQLite database. Re-scanning a previously mapped directory skips unchanged files, querying the model only for newly modified source code.
