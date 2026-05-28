import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Sparkles } from "lucide-react";
import "./App.css";

// Components
import { Sidebar } from "./components/layout/Sidebar";
import { Header, GraphLayer } from "./components/layout/Header";
import { BottomPanel } from "./components/layout/BottomPanel";
import { ReactFlowGraph } from "./components/graph/ReactFlowGraph";
import { ThreeDGraph } from "./components/graph/ThreeDGraph";
import { getLayoutedElements } from "./utils/layout"; // Layout and spacing utility
import { Edge, MarkerType } from "@xyflow/react";

interface GraphData {
  nodes: { id: string; label: string; group: string; semantic_group?: string; summary?: string }[];
  edges: { source: string; target: string; via: string | null; is_data_source?: boolean }[];
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
  const [isEnriching, setIsEnriching] = useState(false);

  // Layout spacing state
  const [nodesep, setNodesep] = useState(70);
  const [ranksep, setRanksep] = useState(400);
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('TB');

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('gemini_model') || 'models/gemini-1.5-flash');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [enableAi, setEnableAi] = useState(() => {
    const saved = localStorage.getItem('enable_ai_summary');
    return saved === null ? true : saved === 'true';
  });

  const handleDeleteNode = useCallback((nodeId: string, nodePath: string) => {
    setRawGraphData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== nodeId),
        edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
      };
    });
    setLogs(prev => [...prev, `> Permanently deleted: ${nodePath}`]);
  }, []);

  useEffect(() => {
    if (showSettings && apiKey) {
      setIsLoadingModels(true);
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.models) {
            const generateContentModels = data.models.filter((m: any) =>
              m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
            );
            setAvailableModels(generateContentModels);
            if (!selectedModel || !generateContentModels.find((m: any) => m.name === selectedModel)) {
              if (generateContentModels.length > 0) {
                setSelectedModel(generateContentModels[0].name);
              }
            }
          }
        })
        .catch(err => console.error("Failed to load models", err))
        .finally(() => setIsLoadingModels(false));
    }
  }, [showSettings, apiKey]);

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

        if (apiKey && enableAi) {
          setLogs(prev => [...prev, `> Found API Key, starting progressive AI enrichment with ${selectedModel}...`]);
          setIsEnriching(true);
          try {
            await invoke("enrich_graph_with_ai", { graphData: result, apiKey, model: selectedModel });
          } catch (aiErr) {
            console.error("AI Enrichment Error:", aiErr);
            setLogs(prev => [...prev, `> AI Error: ${String(aiErr)}`]);
            setIsEnriching(false);
          }
        } else if (apiKey && !enableAi) {
          setLogs(prev => [...prev, `> AI summary generation is disabled in Settings.`]);
        }
      }
    } catch (e) {
      console.error(e);
      setLogs(prev => [...prev, `> Error: ${String(e)}`]);
      setIsParsing(false);
    }
  };

  useEffect(() => {
    const unlisten = listen("ai_nodes_enriched", (event) => {
      const enrichedNodes = event.payload as { id: string; semantic_group: string; summary: string }[];

      setRawGraphData(prev => {
        if (!prev) return prev;

        const newNodes = prev.nodes.map(node => {
          const enrichment = enrichedNodes.find(en => en.id === node.id);
          if (enrichment) {
            return {
              ...node,
              semantic_group: enrichment.semantic_group,
              summary: enrichment.summary
            };
          }
          return node;
        });

        return {
          ...prev,
          nodes: newNodes
        };
      });

      setLogs(prev => [...prev, `> AI enriched ${enrichedNodes.length} nodes.`]);
    });

    const unlistenComplete = listen("ai_enrichment_complete", () => {
      setIsEnriching(false);
      setLogs(prev => [...prev, `> Progressive AI Enrichment fully completed.`]);
    });

    return () => {
      unlisten.then(f => f());
      unlistenComplete.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (!rawGraphData) return;

    // Calculate in-degrees for all files using the complete raw edges list before layout filtering
    // to prevent components imported only inside layouts (e.g. CustomCursor, DynamicBackground) from being flagged as dead code.
    const inDegrees = new Map<string, number>();
    rawGraphData.edges.forEach(e => {
      inDegrees.set(e.target, (inDegrees.get(e.target) || 0) + 1);
    });

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

    // stable handleDeleteNode is called here


    const initialNodes = filteredRawNodes.map((n) => {
      let subLabel = 'File';
      let isBackend = false;

      const pathLower = n.id.toLowerCase();
      if (pathLower.includes('/api/') || n.label.startsWith('route.') || pathLower.includes('controller') || pathLower.includes('handler')) {
        subLabel = 'API / Controller';
        isBackend = true;
      } else if (pathLower.includes('/server/') || pathLower.includes('/backend/') || pathLower.includes('service')) {
        subLabel = 'Backend Service';
        isBackend = true;
      } else if (pathLower.includes('src-tauri')) {
        subLabel = 'Rust Backend';
        isBackend = true;
      } else if (['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(n.group)) {
        subLabel = 'UI Component';
      } else if (['ts', 'js', 'py', 'rs'].includes(n.group)) {
        subLabel = 'Script';
      }

      // Flag common entry point files across frameworks (Next.js, Vite, React Native, Flutter, etc.)
      const isEntryPoint = /^(page|layout|loading|template|error|route|main|index|App|lib|app|middleware|sitemap)\./i.test(n.label) || n.id.includes('src-tauri');
      const isDeadCode = (inDegrees.get(n.id) || 0) === 0 && !isEntryPoint;

      // Calculate architectural taxonomy hierarchy
      let layerIndex = 2; // Default script/utilities layer
      if (isBackend) {
        layerIndex = 3; // Backend service & APIs layer
      } else if (/^(page|main|index|app)\./i.test(n.label)) {
        layerIndex = 0; // Entry points / Webpages layer
      } else if (['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(n.group)) {
        layerIndex = 1; // UI components layer
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
          isBackend,
          semantic_group: n.semantic_group,
          summary: n.summary,
          isDeadCode,
          onDelete: () => handleDeleteNode(n.id, n.id),
          direction: layoutDirection,
          layerIndex
        }
      };
    });

    const initialEdges: Edge[] = filteredRawEdges.map((e, i) => {
      let isSource = e.is_data_source === true;

      const sourceId = isSource ? e.target : e.source;
      const targetId = isSource ? e.source : e.target;

      return {
        id: `e-${i}`,
        source: sourceId,
        target: targetId,
        type: 'default',
        animated: false,
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
      };
    });

    const dagreEdges: Edge[] = initialEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    const { nodes: layoutedNodes } = getLayoutedElements(
      initialNodes,
      dagreEdges,
      layoutDirection,
      nodesep,
      ranksep
    );

    const styledEdges = initialEdges.map(e => {
       const sourceNode = layoutedNodes.find(n => n.id === e.source);
       const targetNode = layoutedNodes.find(n => n.id === e.target);
       let sourceHandle = layoutDirection === 'TB' ? 'bottom' : 'right';
       let targetHandle = layoutDirection === 'TB' ? 'top' : 'left';

       if (sourceNode && targetNode) {
          if (layoutDirection === 'TB') {
             // If target is ABOVE source, flow UP from source TOP to target BOTTOM
             if (targetNode.position.y < sourceNode.position.y) {
                 sourceHandle = 'top-source';
                 targetHandle = 'bottom-target';
             }
          } else {
             // If target is LEFT of source, flow LEFT from source LEFT to target RIGHT
             if (targetNode.position.x < sourceNode.position.x) {
                 sourceHandle = 'left-source';
                 targetHandle = 'right-target';
             }
          }
       }
       return { ...e, sourceHandle, targetHandle };
    });

    setFlowNodes(layoutedNodes);
    setFlowEdges(styledEdges);

  }, [rawGraphData, activeLayer, layoutDirection, nodesep, ranksep]);

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
            className="flex items-center space-x-3 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition-all duration-300 font-semibold shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 cursor-pointer mb-4"
          >
            <FolderOpen size={20} />
            <span>Select Project Folder</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="text-slate-400 hover:text-white transition-colors text-sm underline flex items-center justify-center space-x-2"
          >
            <span>Configure API Key</span>
          </button>
        </div>

        {showSettings && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Google AI Studio API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 mb-4"
                />

                <label className="block text-slate-400 text-sm mb-2">AI Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isLoadingModels || !apiKey}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-50 appearance-none"
                >
                  {isLoadingModels ? (
                    <option>Loading models...</option>
                  ) : availableModels.length > 0 ? (
                    availableModels.map(m => (
                      <option key={m.name} value={m.name}>
                        {m.displayName} ({m.name.replace('models/', '')})
                      </option>
                    ))
                  ) : (
                    <option value={selectedModel}>{selectedModel}</option>
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-2">API Key and Model are required for AI-powered graph enrichment.</p>

                <div className="flex items-center space-x-2 mt-4 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="enableAiSummary"
                    checked={enableAi}
                    onChange={(e) => setEnableAi(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                  <label htmlFor="enableAiSummary" className="text-slate-300 text-sm cursor-pointer select-none font-medium">
                    Enable AI Summary Generation
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('gemini_api_key', apiKey);
                    localStorage.setItem('gemini_model', selectedModel);
                    localStorage.setItem('enable_ai_summary', String(enableAi));
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isParsing && !selectedPath) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050510]">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-mono text-sm">{isEnriching ? "Enriching with AI..." : "Analyzing codebase..."}</p>
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
          onSettingsClick={() => setShowSettings(true)}
        />

        <div className="flex-1 relative overflow-hidden bg-[#050510]">
          {viewMode === '2d' ? (
            <ReactFlowGraph
              nodes={flowNodes}
              edges={flowEdges}
              onNodeSelect={setSelectedNode}
              nodesep={nodesep}
              setNodesep={setNodesep}
              ranksep={ranksep}
              setRanksep={setRanksep}
              direction={layoutDirection}
              setDirection={setLayoutDirection}
            />
          ) : (
            <ThreeDGraph
              graphData={rawGraphData}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
            />
          )}
        </div>

        <BottomPanel selectedNode={selectedNode} logs={logs} />
      </div>

      {showSettings && selectedPath && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>
            <div className="mb-6">
              <label className="block text-slate-400 text-sm mb-2">Google AI Studio API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 mb-4"
              />

              <label className="block text-slate-400 text-sm mb-2">AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoadingModels || !apiKey}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-50 appearance-none mb-2"
              >
                {isLoadingModels ? (
                  <option>Loading models...</option>
                ) : availableModels.length > 0 ? (
                  availableModels.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.displayName} ({m.name.replace('models/', '')})
                    </option>
                  ))
                ) : (
                  <option value={selectedModel}>{selectedModel}</option>
                )}
              </select>
              <p className="text-xs text-slate-500 mt-2">API Key and Model are required for AI-powered graph enrichment.</p>

              <div className="flex items-center space-x-2 mt-4 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="enableAiSummaryWorkspace"
                  checked={enableAi}
                  onChange={(e) => setEnableAi(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
                <label htmlFor="enableAiSummaryWorkspace" className="text-slate-300 text-sm cursor-pointer select-none font-medium">
                  Enable AI Summary Generation
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('gemini_api_key', apiKey);
                  localStorage.setItem('gemini_model', selectedModel);
                  localStorage.setItem('enable_ai_summary', String(enableAi));
                  setShowSettings(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
