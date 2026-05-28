import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Sparkles, X, Eye, EyeOff, RefreshCw, Zap } from "lucide-react";
import "./App.css";
import { load } from '@tauri-apps/plugin-store';

// Components
import { Sidebar } from "./components/layout/Sidebar";
import { Header, GraphLayer } from "./components/layout/Header";
import { BottomPanel } from "./components/layout/BottomPanel";
import { ReactFlowGraph } from "./components/graph/ReactFlowGraph";
import { ThreeDGraph } from "./components/graph/ThreeDGraph";
import { getLayoutedElements } from "./utils/layout";
import { Edge, MarkerType } from "@xyflow/react";

interface GraphData {
  nodes: { id: string; label: string; group: string; semantic_group?: string; summary?: string }[];
  edges: { source: string; target: string; via: string | null; is_data_source?: boolean }[];
}

// ─── Settings Modal ────────────────────────────────────────
interface SettingsModalProps {
  apiKey: string;
  setApiKey: (val: string) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  enableAi: boolean;
  setEnableAi: (val: boolean) => void;
  preferredIde: string;
  setPreferredIde: (val: string) => void;
  onClose: () => void;
}

function SettingsModal({ apiKey, setApiKey, selectedModel, setSelectedModel, enableAi, setEnableAi, preferredIde, setPreferredIde, onClose }: SettingsModalProps) {
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (apiKey) {
      loadModels();
    }
  }, [apiKey]);

  const loadModels = async () => {
    if (!apiKey) return;
    setIsLoadingModels(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
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
    } catch (err) {
      console.error("Failed to load models", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', selectedModel);
    localStorage.setItem('enable_ai_summary', String(enableAi));
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center nebula-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 nebula-slide-up">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-main">Settings</h2>
            <button
              onClick={onClose}
              className="p-1.5 text-text-dim hover:text-text-main hover:bg-surface-raised rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5">
            {/* API Key */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 pr-10 font-mono placeholder:text-text-dim/40 transition-colors"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors cursor-pointer"
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase">AI Model</label>
                <button
                  onClick={loadModels}
                  disabled={!apiKey || isLoadingModels}
                  className="p-1 text-text-dim hover:text-blue-400 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Refresh models"
                >
                  <RefreshCw size={13} className={isLoadingModels ? 'animate-spin' : ''} />
                </button>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoadingModels || !apiKey}
                className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 disabled:opacity-40 appearance-none cursor-pointer transition-colors"
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
            </div>

            {/* AI Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-raised border border-border-subtle">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-text-main">AI Summary Generation</span>
                <span className="text-[11px] text-text-dim mt-0.5">Automatically enrich nodes with AI analysis</span>
              </div>
              <div
                onClick={() => setEnableAi(!enableAi)}
                className={`nebula-switch ${enableAi ? 'active' : ''}`}
              />
            </div>

            {/* Preferred IDE */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Preferred IDE</label>
              <select
                value={preferredIde}
                onChange={(e) => setPreferredIde(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 appearance-none cursor-pointer transition-colors"
              >
                <option value="code">VS Code (code)</option>
                <option value="cursor">Cursor (cursor)</option>
                <option value="idea">IntelliJ IDEA (idea)</option>
                <option value="webstorm">WebStorm (webstorm)</option>
                <option value="nvim">Neovim (nvim)</option>
              </select>
            </div>

            {/* Test Connection */}
            {apiKey && (
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border ${
                  testStatus === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : testStatus === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-surface-raised border-border hover:border-blue-500/30 text-text-muted hover:text-text-main'
                }`}
              >
                <Zap size={14} />
                {testStatus === 'testing' ? 'Testing...' :
                 testStatus === 'success' ? 'Connection Successful!' :
                 testStatus === 'error' ? 'Connection Failed' :
                 'Test Connection'}
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-subtle">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors cursor-pointer rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────

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

  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('gemini_model') || 'models/gemini-1.5-flash');
  const [enableAi, setEnableAi] = useState(() => {
    const saved = localStorage.getItem('enable_ai_summary');
    return saved === null ? true : saved === 'true';
  });

  const [isLightMode, setIsLightMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light';
  });

  const [preferredIde, setPreferredIde] = useState('code');

  useEffect(() => {
    load('settings.json', { autoSave: false, defaults: { preferredIde: 'code' } }).then(store => {
      store.get<string>('preferredIde').then(val => {
        if (val) setPreferredIde(val);
      });
    });
  }, []);

  const handleSetPreferredIde = async (val: string) => {
    setPreferredIde(val);
    const store = await load('settings.json', { autoSave: false, defaults: { preferredIde: 'code' } });
    await store.set('preferredIde', val);
    await store.save();
  };

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

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
      // Visually, we want information to flow from the imported file up to the importer.
      // e.source is the Importer, e.target is the Imported.
      const sourceId = e.target;
      const targetId = e.source;

      return {
        id: `e-${i}`,
        source: sourceId,
        target: targetId,
        type: 'default',
        animated: false,
        data: {
          originalSource: e.source,
          originalTarget: e.target,
        },
        label: e.via ? `via ${e.via}` : undefined,
        labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#111118', fillOpacity: 0.9, stroke: '#1e1e2a', strokeWidth: 1 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
        style: { stroke: '#334155', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#334155',
        },
      };
    });

    // For layout, we always want Importer (top) -> Imported (bottom)
    const dagreEdges: Edge[] = filteredRawEdges.map((e, i) => ({
      id: `e-${i}`,
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
             if (targetNode.position.y < sourceNode.position.y) {
                 sourceHandle = 'top-source';
                 targetHandle = 'bottom-target';
             }
          } else {
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

  // ─── Welcome Screen ───────────────────────────────────────

  if (!selectedPath && !isParsing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-text-dim/5 rounded-full blur-3xl" />
        </div>

        {/* Card */}
        <div className="z-10 flex flex-col items-center nebula-glass p-12 rounded-2xl max-w-md text-center shadow-2xl nebula-slide-up">
          {/* Logo */}
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-6">
            <Sparkles className="text-white" size={28} />
          </div>

          <h1 className="text-4xl font-serif font-medium text-text-main mb-3 tracking-tight">CodeMapper</h1>
          <p className="text-text-muted mb-8 text-[15px] leading-relaxed font-serif">
            Visualize your codebase architecture in stunning 2D and 3D graphs.
          </p>

          <button
            onClick={handleSelectDirectory}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 cursor-pointer mb-4"
          >
            <FolderOpen size={18} />
            <span>Select Project Folder</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="text-text-dim hover:text-text-muted transition-colors text-sm cursor-pointer underline underline-offset-2"
          >
            Configure API Key
          </button>
        </div>

        {showSettings && (
          <SettingsModal
            apiKey={apiKey} setApiKey={setApiKey}
            selectedModel={selectedModel} setSelectedModel={setSelectedModel}
            enableAi={enableAi} setEnableAi={setEnableAi}
            preferredIde={preferredIde} setPreferredIde={handleSetPreferredIde}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    );
  }

  // ─── Loading Screen ───────────────────────────────────────

  if (isParsing && !selectedPath) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center nebula-slide-up">
          <div className="w-12 h-12 border-4 border-surface-raised border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-text-muted font-mono text-sm">
            {isEnriching ? "Enriching with AI..." : "Analyzing codebase..."}
          </p>
        </div>
      </div>
    );
  }

  // ─── Main Workspace ───────────────────────────────────────

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background relative">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 relative overflow-hidden bg-background">
          <Header
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            onSettingsClick={() => setShowSettings(true)}
            isLightMode={isLightMode}
            setIsLightMode={setIsLightMode}
          />

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
              isLightMode={isLightMode}
            />
          ) : (
            <ThreeDGraph
              graphData={rawGraphData}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
            />
          )}
        </div>

        <BottomPanel selectedNode={selectedNode} logs={logs} preferredIde={preferredIde} />
      </div>

      {showSettings && selectedPath && (
        <SettingsModal
          apiKey={apiKey} setApiKey={setApiKey}
          selectedModel={selectedModel} setSelectedModel={setSelectedModel}
          enableAi={enableAi} setEnableAi={setEnableAi}
          preferredIde={preferredIde} setPreferredIde={handleSetPreferredIde}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
