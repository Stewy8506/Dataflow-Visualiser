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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileNode } from './FileNode';

const nodeTypes: NodeTypes = {
  fileNode: FileNode,
};

interface ReactFlowGraphProps {
  nodes: any[];
  edges: any[];
  onNodeSelect: (node: any) => void;
}

export function ReactFlowGraph({ nodes: initialNodes, edges: initialEdges, onNodeSelect }: ReactFlowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const connectedNodes = useMemo(() => {
    if (!selectedNodeId) return null;
    const connected = new Set<string>();
    connected.add(selectedNodeId);

    // BFS to find descendants
    let queue = [selectedNodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of initialEdges) {
        if (edge.source === current && !connected.has(edge.target)) {
          connected.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    // BFS to find ancestors
    queue = [selectedNodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of initialEdges) {
        if (edge.target === current && !connected.has(edge.source)) {
          connected.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    return connected;
  }, [selectedNodeId, initialEdges]);

  // Update state if initial props or selection changes
  useEffect(() => {
    const styledNodes = initialNodes.map(node => {
      const isConnected = connectedNodes ? connectedNodes.has(node.id) : true;
      const isSelected = selectedNodeId === node.id;
      return {
        ...node,
        selected: isSelected,
        style: {
          ...node.style,
          opacity: isConnected ? 1 : 0.2,
          filter: isConnected ? 'none' : 'grayscale(100%) blur(1px)',
          pointerEvents: isConnected ? 'all' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }
      };
    });

    const styledEdges = initialEdges.map(edge => {
      const isConnected = connectedNodes ? connectedNodes.has(edge.source) && connectedNodes.has(edge.target) : true;
      const isDirectlyConnected = selectedNodeId === edge.source || selectedNodeId === edge.target;
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isConnected ? 1 : 0.05,
          strokeWidth: isDirectlyConnected ? 3 : 2,
          stroke: isDirectlyConnected ? '#3b82f6' : '#475569',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        animated: isConnected,
      };
    });

    setNodes(styledNodes);
    setEdges(styledEdges);
  }, [initialNodes, initialEdges, connectedNodes, selectedNodeId, setNodes, setEdges]);

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
    <div className="w-full h-full bg-[#0a0a0c]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        className="codebase-flow"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={24} size={1} />
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
    </div>
  );
}
