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
}: ReactFlowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const activeNodeId = hoveredNodeId || selectedNodeId;

  const blastRadius = useMemo(() => {
    if (!activeNodeId) return null;
    return calculateBlastRadius(activeNodeId, initialEdges);
  }, [activeNodeId, initialEdges]);

  // Update state if initial props or selection changes
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
      let borderColor = node.style?.border || 'rgba(255,255,255,0.1)';
      let pulseStyle = {};

      if (isConnected && blastRadius && tier >= 0) {
        if (tier === 0) {
          // Selected Node
          borderColor = '#3b82f6'; // Blue
          pulseStyle = { boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' };
        } else if (tier === 1) {
          // Tier 1 (High Risk)
          borderColor = '#ef4444'; // Red
          pulseStyle = { boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' };
        } else {
          // Tier 2+ (Moderate Risk)
          borderColor = '#f59e0b'; // Amber
          pulseStyle = { boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)' };
        }
      }

      return {
        ...node,
        selected: isSelected,
        style: {
          ...node.style,
          ...pulseStyle,
          borderColor: isConnected && blastRadius ? borderColor : node.style?.borderColor,
          borderWidth: isConnected && blastRadius && tier >= 0 ? '2px' : node.style?.borderWidth,
          opacity: isConnected ? 1 : 0.2,
          filter: isConnected ? 'none' : 'grayscale(100%) blur(1px)',
          pointerEvents: isConnected ? 'all' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
      
      let strokeColor = '#64748b'; // default slate
      if (blastRadius && isConnected) {
        if (targetTier === 0 && sourceTier === 1) {
           strokeColor = '#ef4444'; // Red (Tier 1 direct impact)
        } else if (targetTier > 0 && sourceTier > targetTier) {
           strokeColor = '#f59e0b'; // Amber (Tier 2+ impact flow)
        } else {
           strokeColor = '#94a3b8';
        }
      }

      const markerEnd = edge.markerEnd && typeof edge.markerEnd === 'object'
        ? { ...edge.markerEnd, color: strokeColor }
        : edge.markerEnd;

      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: noActiveNode ? 0.15 : (isConnected ? 0.8 : 0.05),
          strokeWidth: isDirectlyConnected ? 3 : (isConnected ? 2 : 1),
          stroke: strokeColor,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        markerEnd,
        animated: isConnected && blastRadius,
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
    <div className="w-full h-full bg-[#0a0a0c] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        minZoom={0.05}
        maxZoom={4}
        className="codebase-flow"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#475569" gap={20} size={1.5} variant={BackgroundVariant.Dots} />
        <Controls 
          className="bg-slate-900 border-slate-700 fill-slate-300 [&>button]:border-b-slate-700 hover:[&>button]:bg-slate-800"
        />
        <MiniMap 
          nodeColor={(n) => {
            if (n.data?.group === 'tsx' || n.data?.group === 'ts') return '#3b82f6';
            if (n.data?.group === 'css') return '#38bdf8';
            if (n.data?.group === 'json') return '#4ade80';
            return '#94a3b8';
          }}
          maskColor="rgba(10, 10, 12, 0.7)"
          className="bg-slate-900 border-slate-700 rounded-lg overflow-hidden"
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
