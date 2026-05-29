export interface CycleResult {
  cycles: string[][];
  edgesInCycles: Set<string>;
  nodesInCycles: Set<string>;
}

export function detectCycles(edges: { source: string; target: string }[]): CycleResult {
  // Build adjacency list. We use original source/target or fall back to source/target
  const adjacencyList = new Map<string, string[]>();
  
  for (const edge of edges) {
    // In our app, edges are visually drawn from Imported (source) to Importer (target)
    // To find circular *imports*, the dependency direction is Importer -> Imported.
    // In our edge list, the Importer is e.target and Imported is e.source,
    // or if we use originalSource/Target from data: originalSource is Importer, originalTarget is Imported.
    // So the semantic dependency edge is from Importer -> Imported.
    // Let's rely on the original dependency direction for cycle detection.
    const importer = (edge as any).data?.originalSource || edge.source;
    const imported = (edge as any).data?.originalTarget || edge.target;
    
    if (!adjacencyList.has(importer)) {
      adjacencyList.set(importer, []);
    }
    adjacencyList.get(importer)!.push(imported);
  }

  const visited = new Map<string, 0 | 1 | 2>(); // 0: unvisited, 1: visiting (in stack), 2: visited
  const parent = new Map<string, string>();
  
  const cycles: string[][] = [];
  const edgesInCycles = new Set<string>();
  const nodesInCycles = new Set<string>();

  function dfs(node: string) {
    visited.set(node, 1); // Mark as visiting

    const neighbors = adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor) || 0;
      
      if (state === 0) {
        parent.set(neighbor, node);
        dfs(neighbor);
      } else if (state === 1) {
        // Cycle detected
        const cycle: string[] = [];
        let curr = node;
        
        // Backtrack to extract cycle
        while (curr !== neighbor && curr !== undefined) {
          cycle.push(curr);
          curr = parent.get(curr)!;
        }
        cycle.push(neighbor);
        cycle.reverse();
        
        // Normalize cycle (rotate to have lexicographically smallest element first)
        // to avoid duplicate cycles being added if we enter them from different paths.
        // For simplicity in UI, we'll just record the edges and nodes.
        cycles.push(cycle);
        
        // Add to sets for O(1) lookup
        for (let i = 0; i < cycle.length; i++) {
          const from = cycle[i];
          const to = cycle[(i + 1) % cycle.length];
          nodesInCycles.add(from);
          // The edge key must match what we check against.
          // Since our React Flow edges use source=Imported, target=Importer
          // OR if we check using originalSource/originalTarget:
          edgesInCycles.add(`${from}->${to}`); 
        }
      }
    }

    visited.set(node, 2); // Mark as visited
  }

  for (const node of adjacencyList.keys()) {
    if (!visited.has(node) || visited.get(node) === 0) {
      dfs(node);
    }
  }

  return { cycles, edgesInCycles, nodesInCycles };
}
