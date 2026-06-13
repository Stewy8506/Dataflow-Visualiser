# Security & Privacy Architecture

Dataflow Visualiser is designed for enterprise environments where source code privacy is non-negotiable. It implements a strict local-first processing architecture.

---

## 1. Local-First Processing Boundaries

Unlike traditional architecture visualization tools that require uploading repositories to external cloud environments, Dataflow Visualiser works entirely on your machine:

*   **No Code Exfiltration**: Code crawling, parsing, relationship building, and indexing occur inside a local process.
*   **Opt-in AI Integrations**:
    *   If using cloud-based AI providers (e.g. Gemini, OpenAI, Claude), only the specific code snippets explicitly selected by the user for Q&A or refactoring are sent to the API.
    *   No automatic whole-repository ingestion is performed.
    *   For strict zero-trust networks, configuring a local model (via Ollama or LMStudio) ensures that **100% of data remains offline** on local hardware.

---

## 2. Directory Sandboxing & Path Containment

Because the application interacts with your terminal shell and filesystem, we implement strong isolation policies in the Rust core:

```
                  Local File System
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
┌──────────────┐                  ┌──────────────┐
│  Workspace   │                  │  Restricted  │
│  Directory   │                  │ (System Dir) │
│ (Authorized) │                  │ (Blocklisted)│
└──────┬───────┘                  └──────┬───────┘
       │                                 │
       ▼                                 ▼
[Path Verification]              [Path Verification]
   - Is Ancestor?                   - Outside Boundary?
   - Resolve Symlink                - Threat Detected
       │                                 │
       ▼ (Permit Write/Read)             ▼ (Raise Security Error)
[Permitted Operation]            [Abort Operation]
```

*   **Boundary Enforcement**: Every filesystem command (e.g. `delete_file`, `write_refactor_draft`, `read_source_file`) resolves canonicalized absolute paths and validates that they reside within the workspace directory.
*   **Path Traversal Prevention**: Commands attempting to pass parent traversal paths (e.g., `../../etc/passwd`) are intercepted and rejected by the Rust state layer prior to execution.
*   **Terminal Isolation**: The integrated terminal relies on native portable-pty bindings, executing with the permissions of the current logged-in user, constrained to the initialized folder.

---

## 3. Dependency Vulnerability Auditing (OSV API)

To protect developer pipelines, the graph engine performs audits of external packages:
*   **Lockfile Parsing**: The backend reads `package-lock.json` or `pubspec.lock` declarations.
*   **OSV Integration**: It cross-references package names and version hashes against the open-source vulnerability database [osv.dev](https://osv.dev).
*   **UI Indication**: Any flagged packages are annotated with red vulnerability indicators and linked to their CVE listings.
