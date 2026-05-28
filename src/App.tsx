import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Sparkles } from "lucide-react";
import "./App.css";

// Components
import { Sidebar } from "./components/layout/Sidebar";
import { Header, GraphLayer } from "./components/layout/Header";
import { BottomPanel } from "./components/layout/BottomPanel";
import { ReactFlowGraph } from "./components/graph/ReactFlowGraph";
import { ThreeDGraph } from "./components/graph/ThreeDGraph";
import { getLayoutedElements } from "./utils/layout";
import { Edge, MarkerType } from "@xyflow/react";

interface GraphData {
  nodes: { id: string; label: string; group: string }[];
  edges: { source: string; target: string; via: string | null }[];
}

function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [activeLayer, setActiveLayer] = useState<GraphLayer>('overall');
  
  // Data state
  const [rawGraphData, setRawGraphData] = useState<GraphData | null>(null);
  const [flowNodes, setFlowNodes] = useState<any[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  
  // UI state
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const handleSelectDirectory = async () => {
    try {
      const path = await open({
        directory: true,
        multiple: false,
      });
      
      if (path) {
        setIsParsing(true);
        setLogs(prev => [...prev, `> Selected directory: ${path}`, '> Parsing codebase...']);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const result: GraphData = await invoke("parse_codebase", { path });
        
        setRawGraphData(result);
        setSelectedPath(path);
        setLogs(prev => [...prev, `> Parsed ${result.nodes.length} files successfully.`]);
        setIsParsing(false);
      }
    } catch (e) {
      console.error(e);
      setLogs(prev => [...prev, `> Error: ${String(e)}`]);
      setIsParsing(false);
    }
  };

  useEffect(() => {
    if (!rawGraphData) return;

    // Filter nodes based on active layer
    const filteredRawNodes = rawGraphData.nodes.filter(n => {
      const isBackend = n.id.includes('/api/') || n.label.startsWith('route.') || n.id.includes('/server/') || n.id.includes('/backend/') || n.id.includes('src-tauri');
      if (activeLayer === 'ui') return !isBackend;
      if (activeLayer === 'backend') return isBackend;
      return true; // overall
    });

    const validNodeIds = new Set(filteredRawNodes.map(n => n.id));

    // Filter edges
    const filteredRawEdges = rawGraphData.edges.filter(e => 
      validNodeIds.has(e.source) && validNodeIds.has(e.target)
    );

    const initialNodes = filteredRawNodes.map((n) => {
      let subLabel = 'File';
      let isBackend = false;
      
      if (n.id.includes('/api/') || n.label.startsWith('route.')) {
        subLabel = 'API Route';
        isBackend = true;
      } else if (n.id.includes('/server/') || n.id.includes('/backend/')) {
        subLabel = 'Backend Service';
        isBackend = true;
      } else if (n.id.includes('src-tauri')) {
        subLabel = 'Rust Backend';
        isBackend = true;
      } else if (n.group === 'tsx' || n.group === 'jsx') {
        subLabel = 'React Component';
      } else if (n.group === 'ts' || n.group === 'js') {
        subLabel = 'Script';
      }

      return {
        id: n.id,
        type: 'fileNode',
        position: { x: 0, y: 0 },
        data: {
          label: n.label,
          path: n.id,
          subLabel,
          group: n.group,
          type: n.group.toUpperCase(),
          isBackend
        }
      };
    });

    const initialEdges: Edge[] = filteredRawEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      type: 'default',
      animated: true,
      label: e.via ? `via ${e.via}` : undefined,
      labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9, stroke: '#334155', strokeWidth: 1 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 6,
      style: { stroke: '#475569', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#475569',
      },
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      'LR'
    );

    setFlowNodes(layoutedNodes);
    setFlowEdges(layoutedEdges);

  }, [rawGraphData, activeLayer]);

  if (!selectedPath && !isParsing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050510] relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="z-10 flex flex-col items-center bg-slate-900/50 p-12 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl max-w-md text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
            <Sparkles className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">CodeMapper</h1>
          <p className="text-slate-400 mb-8 text-sm">
            Visualize your codebase architecture in stunning 2D and 3D graphs.
          </p>
          
          <button
            onClick={handleSelectDirectory}
            className="flex items-center space-x-3 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition-all duration-300 font-semibold shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 cursor-pointer"
          >
            <FolderOpen size={20} />
            <span>Select Project Folder</span>
          </button>
        </div>
      </div>
    );
  }

  if (isParsing && !selectedPath) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050510]">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-mono text-sm">Analyzing codebase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header 
          viewMode={viewMode} 
          onViewModeChange={setViewMode} 
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
        />
        
        <div className="flex-1 relative overflow-hidden bg-[#050510]">
          {viewMode === '2d' ? (
            <ReactFlowGraph 
              nodes={flowNodes} 
              edges={flowEdges} 
              onNodeSelect={setSelectedNode} 
            />
          ) : (
            <ThreeDGraph graphData={rawGraphData} />
          )}
        </div>
        
        <BottomPanel selectedNode={selectedNode} logs={logs} />
      </div>
    </div>
  );
}

export default App;
