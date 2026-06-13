# Blast-Radius Simulation & Refactor Engine

The blast-radius simulation allows developers to ask: *"If I change or refactor this module, what is the exact footprint of files that must adapt?"*

---

## 1. Downstream Traversal Logic

The simulation parses dependencies as a directed graph $G = (V, E)$, where $V$ represents codebase files and $E$ represents import statements directed from the importing module to the imported module.

When a node $v_{target}$ is highlighted for a simulated change, the engine performs a **Downstream Depth-First Search (DFS)** to find all ancestors that import it:

```
        Simulated Change
               ↓
          [Target Node]
          ↗           ↖
      [Import A]     [Import B]  ← (Direct dependencies / High Impact)
      ↗        ↖          ↖
  [File C]   [File D]   [File E]  ← (Transitive dependencies / Medium Impact)
```

The algorithm is defined in [blastRadius.ts](file:///c:/Users/dasan/Documents/Dataflow-Visualiser/frontend/utils/blastRadius.ts):
1.  Initialize a set of visited nodes and an empty map of distances.
2.  Add $v_{target}$ to the queue with a distance of `0`.
3.  For each node $u$ that has an edge pointing to the current node (meaning $u$ imports the current node), enqueue $u$ and set its distance as `distance + 1`.
4.  Track traversal depth to compute severity ratings.

---

## 2. Severity Categorization Tiers

Nodes identified during downstream traversal are color-coded in the UI according to their proximity to the target node:

| Proximity | Tier | UI Color | Risk Description |
| :--- | :--- | :--- | :--- |
| **Distance = 1** | **Direct Impact** | **Crimson / Deep Red** | Direct imports. Modifying exported types or parameters in the target will immediately throw compiler errors or break runtime integrations here. |
| **Distance = 2** | **Secondary Impact** | **Orange** | Files importing the Direct Impact modules. Often requires cascading API changes or prop updates. |
| **Distance > 2** | **Indirect Impact** | **Amber / Light Yellow** | Transitive imports. Low direct risk, but potential for subtle side effects or behavioral regressions. |

---

## 3. AI-Powered Executable Refactoring

When the user chooses to proceed with an automated refactor:
1.  **Context Construction**: The Rust backend parses the source code of the target file, the proposed refactoring instructions, and the source code of all files in the **Direct Impact** tier.
2.  **API Ingestion**: A structured request is sent to the configured AI API (e.g., Google Gemini) containing the target file, instructions, and dependent code.
3.  **Code Rewrites**: The model generates a JSON payload containing exact replacements or updated files.
4.  **Local Application**: The Rust engine saves the files as temporary drafts to avoid destructive overwrites prior to review.

---

## 4. Visual Validation & Monaco Diffing

Before writing changes permanently to the workspace, developers inspect the results in the **Split-Pane Diff Viewer**:
-   **Monaco Integration**: Built on Microsoft's Monaco Editor, rendering a side-by-side or inline line-by-line diff.
-   **Git Hook**: Automatically triggers a repository scan after the user clicks "Approve Refactor" to update the graph state, reflecting the newly established architecture.
