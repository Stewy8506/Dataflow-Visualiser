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

  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
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
    
    // Sort nodes within the rank. 
    // Nodes with more incoming than outgoing go on the left (lower index).
    // Nodes with more outgoing than incoming go on the right (higher index).
    group.sort((a, b) => {
      const inA = inDegree.get(a.id) || 0;
      const outA = outDegree.get(a.id) || 0;
      const totalA = inA + outA;
      const ratioA = totalA === 0 ? 0.5 : inA / totalA;

      const inB = inDegree.get(b.id) || 0;
      const outB = outDegree.get(b.id) || 0;
      const totalB = inB + outB;
      const ratioB = totalB === 0 ? 0.5 : inB / totalB;

      if (Math.abs(ratioB - ratioA) < 0.01) {
        // Fallback to Dagre's crossing minimization coordinate
        return isLR ? a.dagreY - b.dagreY : a.dagreX - b.dagreX;
      }
      return ratioB - ratioA; // Descending order: highest incoming ratio first (left)
    });

    // Limit the maximum number of rows to balance vertical/horizontal spread
    const maxItemsPerLine = 10;
    const lines = Math.ceil(group.length / maxItemsPerLine);
    const intraRankGap = 150; // Increased to prevent horizontal overlaps

    for (let lineIndex = 0; lineIndex < lines; lineIndex++) {
      const rowNodes = group.slice(lineIndex * maxItemsPerLine, (lineIndex + 1) * maxItemsPerLine);
      
      // 1. Sort nodes within the row by Dagre's optimized coordinates to minimize crossing
      rowNodes.sort((a, b) => isLR ? a.dagreY - b.dagreY : a.dagreX - b.dagreX);

      // 2. Calculate center alignment offset for short rows
      const itemsInThisLine = rowNodes.length;
      const totalSpanForThisLine = isLR ? itemsInThisLine * (nodeHeight + nodesep) : itemsInThisLine * (nodeWidth + nodesep);
      const maxSpan = isLR ? maxItemsPerLine * (nodeHeight + nodesep) : maxItemsPerLine * (nodeWidth + nodesep);
      const centerOffset = (maxSpan - totalSpanForThisLine) / 2;

      rowNodes.forEach((node, itemIndex) => {
        let finalX = 0;
        let finalY = 0;

        if (isLR) {
          finalX = currentOffset + lineIndex * (nodeWidth + intraRankGap);
          finalY = centerOffset + itemIndex * (nodeHeight + nodesep);
        } else {
          finalX = centerOffset + itemIndex * (nodeWidth + nodesep);
          finalY = currentOffset + lineIndex * (nodeHeight + intraRankGap);
        }

        // Remove temporary dagre properties
        const { dagreX, dagreY, ...cleanNode } = node;

        finalNodes.push({
          ...cleanNode,
          position: { x: finalX, y: finalY },
        });
      });
    }

    // Advance the offset for the next rank
    if (isLR) {
      currentOffset += lines * (nodeWidth + intraRankGap) - intraRankGap + ranksep;
    } else {
      currentOffset += lines * (nodeHeight + intraRankGap) - intraRankGap + ranksep;
    }
  }

  return { nodes: finalNodes, edges };
}
