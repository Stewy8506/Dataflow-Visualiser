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
    const originalSource = edge.data?.originalSource || edge.source;
    const originalTarget = edge.data?.originalTarget || edge.target;

    if (edge && originalTarget && originalSource) {
      let list = reverseAdjacency.get(originalTarget);
      if (!list) {
        list = [];
        reverseAdjacency.set(originalTarget, list);
      }
      list.push(originalSource);
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
