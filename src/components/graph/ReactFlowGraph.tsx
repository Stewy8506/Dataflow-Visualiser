import { useCallback, useEffect } from 'react';
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

  // Update state if initial props change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = (_: React.MouseEvent, node: any) => {
    onNodeSelect(node);
  };

  const handlePaneClick = () => {
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
