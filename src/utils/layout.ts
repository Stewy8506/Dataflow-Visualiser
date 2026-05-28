import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = 'LR',
  nodesep = 70,
  ranksep = 400
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 260;
  const nodeHeight = 120;

  dagreGraph.setGraph({ rankdir: direction, nodesep, ranksep, ranker: 'network-simplex' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Group nodes by their major axis to identify ranks
  const isLR = direction === 'LR';
  const rankGroups = new Map<number, any[]>();

  const dagreNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    return { ...node, dagreX: pos.x, dagreY: pos.y };
  });

  // Group nodes into layers based on Dagre's calculated main axis coordinate
  const tolerance = 10;
  dagreNodes.forEach((node) => {
    const mainAxis = isLR ? node.dagreX : node.dagreY;
    let foundKey = -1;
    for (const key of rankGroups.keys()) {
      if (Math.abs(key - mainAxis) < tolerance) {
        foundKey = key;
        break;
      }
    }
    if (foundKey === -1) {
      rankGroups.set(mainAxis, [node]);
    } else {
      rankGroups.get(foundKey)!.push(node);
    }
  });

  const sortedRankKeys = Array.from(rankGroups.keys()).sort((a, b) => a - b);
  
  let currentOffset = 0;
  const finalNodes: Node[] = [];

  for (const key of sortedRankKeys) {
    const group = rankGroups.get(key)!;
    // Sort nodes within the rank by the secondary axis to preserve Dagre's crossing minimization
    group.sort((a, b) => isLR ? a.dagreY - b.dagreY : a.dagreX - b.dagreX);

    // Limit the maximum number of rows to balance vertical/horizontal spread
    const maxItemsPerLine = 10;
    const lines = Math.ceil(group.length / maxItemsPerLine);
    const intraRankGap = 150; // Increased to prevent horizontal overlaps

    group.forEach((node, index) => {
      const lineIndex = Math.floor(index / maxItemsPerLine);
      const itemIndex = index % maxItemsPerLine;

      // Stagger alternating columns to break the rigid grid look and allow edges to flow better
      const staggerOffset = (lineIndex % 2 === 1) ? (nodeHeight + nodesep) / 2 : 0;

      let finalX = 0;
      let finalY = 0;

      if (isLR) {
        finalX = currentOffset + lineIndex * (nodeWidth + intraRankGap);
        finalY = itemIndex * (nodeHeight + nodesep) + staggerOffset;
      } else {
        finalX = itemIndex * (nodeWidth + nodesep) + staggerOffset;
        finalY = currentOffset + lineIndex * (nodeHeight + intraRankGap);
      }

      // Remove temporary dagre properties
      const { dagreX, dagreY, ...cleanNode } = node;

      finalNodes.push({
        ...cleanNode,
        position: { x: finalX, y: finalY },
      });
    });

    // Advance the offset for the next rank
    if (isLR) {
      currentOffset += lines * (nodeWidth + intraRankGap) - intraRankGap + ranksep;
    } else {
      currentOffset += lines * (nodeHeight + intraRankGap) - intraRankGap + ranksep;
    }
  }

  return { nodes: finalNodes, edges };
}
