export interface BlastRadiusResult {
  tiers: Map<string, number>;
  maxTier: number;
}

export function calculateBlastRadius(
  targetNodeId: string,
  edges: any[]
): BlastRadiusResult {
  const tiers = new Map<string, number>();
  tiers.set(targetNodeId, 0);

  let queue = [targetNodeId];
  let currentTier = 0;

  while (queue.length > 0) {
    const nextQueue: string[] = [];
    currentTier++;

    for (const current of queue) {
      // Find all files that import `current` (Reverse Dependency)
      // An edge goes from A (importer) -> B (imported)
      // So if edge.target === current, then edge.source is importing `current`.
      for (const edge of edges) {
        if (edge.target === current && !tiers.has(edge.source)) {
          tiers.set(edge.source, currentTier);
          nextQueue.push(edge.source);
        }
      }
    }

    queue = nextQueue;
  }

  return {
    tiers,
    maxTier: Math.max(0, currentTier - 1)
  };
}
