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

  // Pre-build reverse adjacency map: target -> list of sources importing it
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge && edge.target && edge.source) {
      let list = reverseAdjacency.get(edge.target);
      if (!list) {
        list = [];
        reverseAdjacency.set(edge.target, list);
      }
      list.push(edge.source);
    }
  }

  let queue = [targetNodeId];
  let currentTier = 0;

  while (queue.length > 0) {
    const nextQueue: string[] = [];
    currentTier++;

    for (const current of queue) {
      const importers = reverseAdjacency.get(current);
      if (importers) {
        for (const source of importers) {
          if (!tiers.has(source)) {
            tiers.set(source, currentTier);
            nextQueue.push(source);
          }
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
