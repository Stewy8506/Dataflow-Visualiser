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

  const regularNodes = nodes.filter(n => !n.id.startsWith('ext:'));
  const extNodes = nodes.filter(n => n.id.startsWith('ext:'));
  const regularNodeIds = new Set(regularNodes.map(n => n.id));

  const regularEdges = edges.filter(e => regularNodeIds.has(e.source) && regularNodeIds.has(e.target));
  const extEdges = edges.filter(e => !regularNodeIds.has(e.source) || !regularNodeIds.has(e.target));

  regularNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  });

  regularEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  dagre.layout(dagreGraph);

  // Group nodes by their major axis to identify ranks
  const isLR = direction === 'LR';
  const rankGroups = new Map<number, any[]>();

  const dagreNodes = regularNodes.map((node) => {
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
      // 1. Group by domain (Backend vs Frontend) to strictly separate them
      const isBackendA = a.id.includes('src-tauri');
      const isBackendB = b.id.includes('src-tauri');
      if (isBackendA !== isBackendB) {
        return isBackendA ? 1 : -1; // Put backend on the right (or bottom)
      }

      // 2. Group by directory path to keep related files together
      const dirA = a.id.substring(0, a.id.lastIndexOf('/')) || '';
      const dirB = b.id.substring(0, b.id.lastIndexOf('/')) || '';
      if (dirA !== dirB) {
        return dirA.localeCompare(dirB);
      }

      // 3. Fallback to degree ratio
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
      
      // 1. Sort nodes within the row
      rowNodes.sort((a, b) => {
        // 1. Group by domain
        const isBackendA = a.id.includes('src-tauri');
        const isBackendB = b.id.includes('src-tauri');
        if (isBackendA !== isBackendB) {
          return isBackendA ? 1 : -1;
        }

        // 2. Group by directory path
        const dirA = a.id.substring(0, a.id.lastIndexOf('/')) || '';
        const dirB = b.id.substring(0, b.id.lastIndexOf('/')) || '';
        if (dirA !== dirB) {
          return dirA.localeCompare(dirB);
        }

        // 3. Crossing minimization
        return isLR ? a.dagreY - b.dagreY : a.dagreX - b.dagreX;
      });

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
          width: nodeWidth,
          height: nodeHeight,
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

  // Position external dependency nodes outside of the grid
  const posMap = new Map(finalNodes.map(n => [n.id, n.position]));
  const occupiedSpots = new Map<string, number>();

  extNodes.forEach((extNode) => {
    const incomingEdges = extEdges.filter(e => e.target === extNode.id || e.source === extNode.id);
    let avgX = 0;
    let avgY = 0;
    let count = 0;

    incomingEdges.forEach(e => {
      const sourcePos = posMap.get(e.source);
      if (sourcePos && e.target === extNode.id) {
         avgX += sourcePos.x;
         avgY += sourcePos.y;
         count++;
      }
      const targetPos = posMap.get(e.target);
      if (targetPos && e.source === extNode.id) {
         avgX += targetPos.x;
         avgY += targetPos.y;
         count++;
      }
    });

    if (count > 0) {
      avgX /= count;
      avgY /= count;
    } else {
      // Fallback if disconnected
      avgX = isLR ? currentOffset : 0;
      avgY = isLR ? 0 : currentOffset;
    }

    // Base position slightly offset from the center of importers
    const baseX = avgX + (isLR ? 350 : 0);
    const baseY = avgY + (isLR ? 0 : 250);

    const key = `${Math.round(baseX / 10)},${Math.round(baseY / 10)}`;
    const collisionCount = occupiedSpots.get(key) || 0;
    occupiedSpots.set(key, collisionCount + 1);

    // Spread them out dynamically if multiple dependencies share the exact same origin
    let finalX = baseX;
    let finalY = baseY;

    if (!isLR) { // TB direction
      // spread horizontally below
      finalX = baseX + (collisionCount % 2 === 0 ? 1 : -1) * Math.ceil(collisionCount / 2) * 160;
      finalY = baseY + Math.floor(collisionCount / 4) * 60; // push down if row gets too wide
    } else { // LR direction
      // spread vertically to the right
      finalY = baseY + (collisionCount % 2 === 0 ? 1 : -1) * Math.ceil(collisionCount / 2) * 60;
      finalX = baseX + Math.floor(collisionCount / 4) * 160; // push right if column gets too tall
    }

    finalNodes.push({
      ...extNode,
      position: { x: finalX, y: finalY },
      width: 150,
      height: 40,
    });
  });

  return { nodes: finalNodes, edges };
}
