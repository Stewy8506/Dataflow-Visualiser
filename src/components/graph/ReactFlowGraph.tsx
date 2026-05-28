import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  NodeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileNode } from './FileNode';
import { LayoutController } from './LayoutController';
import { calculateBlastRadius } from '../../utils/blastRadius';

const nodeTypes: NodeTypes = {
  fileNode: FileNode,
};

interface ReactFlowGraphProps {
  nodes: any[];
  edges: any[];
  onNodeSelect: (node: any) => void;
  nodesep: number;
  setNodesep: (val: number) => void;
  ranksep: number;
  setRanksep: (val: number) => void;
  direction: 'LR' | 'TB';
  setDirection: (dir: 'LR' | 'TB') => void;
  isLightMode: boolean;
}

export function ReactFlowGraph({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeSelect,
  nodesep,
  setNodesep,
  ranksep,
  setRanksep,
  direction,
  setDirection,
  isLightMode,
}: ReactFlowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeNodeId = selectedNodeId;

  const blastRadius = useMemo(() => {
    if (!activeNodeId) return null;
    return calculateBlastRadius(activeNodeId, initialEdges);
  }, [activeNodeId, initialEdges]);

  useEffect(() => {
    const styledNodes = initialNodes.map(node => {
      let isConnected = true;
      let tier = -1;
      
      if (blastRadius) {
        if (blastRadius.tiers.has(node.id)) {
          tier = blastRadius.tiers.get(node.id)!;
        } else {
          isConnected = false;
        }
      }

      const isSelected = selectedNodeId === node.id;

      return {
        ...node,
        selected: isSelected,
        data: {
          ...node.data,
          blastTier: tier,
          blastConnected: isConnected,
          hasBlastRadius: !!blastRadius,
        },
        style: {
          ...node.style,
          opacity: isConnected ? 1 : 0.2,
          filter: isConnected ? 'none' : 'grayscale(100%) blur(1px)',
          pointerEvents: isConnected ? 'all' : 'none',
          transition: 'opacity 0.2s, filter 0.2s',
        }
      };
    });

    const styledEdges = initialEdges.map(edge => {
      const sourceTier = blastRadius?.tiers.get(edge.source) ?? -1;
      const targetTier = blastRadius?.tiers.get(edge.target) ?? -1;
      
      const isConnected = sourceTier >= 0 && targetTier >= 0;
      const isOutgoing = activeNodeId === edge.source;
      const isIncoming = activeNodeId === edge.target;
      const isDirectlyConnected = isOutgoing || isIncoming;
      const noActiveNode = !activeNodeId;
      
      let strokeColor = isLightMode ? '#94a3b8' : '#334155';
      if (blastRadius && isConnected) {
        if (sourceTier >= 0 && targetTier > sourceTier) {
           if (targetTier === 1) strokeColor = '#ef4444';
           else if (targetTier === 2) strokeColor = '#f97316';
           else if (targetTier === 3) strokeColor = '#eab308';
           else strokeColor = isLightMode ? '#94a3b8' : '#475569';
        } else {
           strokeColor = isLightMode ? '#94a3b8' : '#334155';
        }
      }

      const markerEnd = edge.markerEnd && typeof edge.markerEnd === 'object'
        ? { ...edge.markerEnd, color: strokeColor }
        : edge.markerEnd;

      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: noActiveNode ? 0.6 : (isConnected ? 0.9 : 0.05),
          strokeWidth: isDirectlyConnected ? 3 : (isConnected ? 2 : 1.5),
          stroke: strokeColor,
          transition: 'opacity 0.2s, stroke 0.2s, stroke-width 0.2s',
        },
        markerEnd,
        animated: isConnected && !!blastRadius,
      };
    });

    setNodes(styledNodes);
    setEdges(styledEdges);
  }, [initialNodes, initialEdges, blastRadius, selectedNodeId, activeNodeId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
    onNodeSelect(node);
  };

  const handlePaneClick = () => {
    setSelectedNodeId(null);
    onNodeSelect(null);
  };

  return (
    <div className="w-full h-full bg-background relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        colorMode={isLightMode ? "light" : "dark"}
        fitView
        minZoom={0.05}
        maxZoom={4}
        className="codebase-flow"
        proOptions={{ hideAttribution: true }}
      >
        <Background color={isLightMode ? "#cbd5e1" : "#475569"} gap={20} size={1.5} variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap 
          nodeColor={() => {
            return isLightMode ? '#94a3b8' : '#475569';
          }}
          maskColor={isLightMode ? "rgba(255, 255, 255, 0.7)" : "rgba(10, 10, 16, 0.7)"}
        />
      </ReactFlow>
      <LayoutController
        nodesep={nodesep}
        setNodesep={setNodesep}
        ranksep={ranksep}
        setRanksep={setRanksep}
        direction={direction}
        setDirection={setDirection}
      />
    </div>
  );
}
