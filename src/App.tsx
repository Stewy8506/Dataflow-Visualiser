import { useEffect } from 'react';
import { FolderOpen, Sparkles, Clock, FolderGit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import './App.css';

// Components
import { TitleBar } from './components/layout/TitleBar';
import { EditorToolbar } from './components/layout/EditorToolbar';
import { StatusBar } from './components/layout/StatusBar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomPanel } from './components/layout/BottomPanel';
import { SearchBar } from './features/search/SearchBar';
import { SourceControlPanel } from './features/source-control/SourceControlPanel';
import { WorkspaceBreadcrumb } from './components/layout/WorkspaceBreadcrumb';
import { CommandPalette } from './features/search/CommandPalette';
import { ExplorerPanel } from './features/explorer/ExplorerPanel';
import { SettingsModal } from './features/settings/SettingsModal';
import { ReactFlowGraph } from './components/graph/ReactFlowGraph';
import { ThreeDGraph } from './components/graph/ThreeDGraph';
import { RefactorPreview } from './features/refactor/RefactorPreview';
import { SnapshotPanel } from './features/snapshots/SnapshotPanel';
import { AiChatModal } from './features/ai/AiChatModal';
import { InteractiveTour } from './features/onboarding/InteractiveTour';
import { KeyboardShortcutsModal } from './features/onboarding/KeyboardShortcutsModal';
import { invoke } from '@tauri-apps/api/core';

// Hooks
import { useSettings } from './hooks/useSettings';
import { useProjectLoader } from './hooks/useProjectLoader';
import { useGraphLayout } from './hooks/useGraphLayout';
import { useAppStore } from './store/appStore';
import { useShallow } from 'zustand/react/shallow';


function App() {
  // ─── Settings ────────────────────────────────────────────────
  const {
    apiKey, setApiKey,
    selectedModel, setSelectedModel,
    enableAi, setEnableAi,
    isLightMode, setIsLightMode,
    preferredIde,
    handleSetPreferredIde,
    aiProvider, setAiProvider,
    localBaseUrl, setLocalBaseUrl,
  } = useSettings();

  // ─── Project Loader ──────────────────────────────────────────
  const {
    selectedPath,
    rawGraphData,
    isParsing,
    isEnriching,
    logs,
    recentProjects,
    enrichmentMap,
    handleSelectDirectory,
    handleOpenRecentProject,
    handleDeleteNode,
  } = useProjectLoader({ apiKey, enableAi, selectedModel, aiProvider, localBaseUrl });

  // ─── UI State (Zustand) ──────────────────────────────────────
  // ─── UI State (Zustand) ──────────────────────────────────────
  const {
    activeTab,
    viewMode,
    setViewMode,
    setActiveLayer,
    showSettings,
    setShowSettings,
    showCommandPalette,
    setShowCommandPalette,
    showMiniMap,
    setShowMiniMap,
    showSnapshots,
    setShowSnapshots,
    showHeatmap,
    churnData,
    setChurnData,
    refactorTarget,
    setRefactorTarget,
    selectedNode,
    setSelectedNode,
    setPropTrace,
    setDiffOverlay,
  } = useAppStore(useShallow(s => ({
    activeTab: s.activeTab,
    viewMode: s.viewMode,
    setViewMode: s.setViewMode,
    setActiveLayer: s.setActiveLayer,
    showSettings: s.showSettings,
    setShowSettings: s.setShowSettings,
    showCommandPalette: s.showCommandPalette,
    setShowCommandPalette: s.setShowCommandPalette,
    showMiniMap: s.showMiniMap,
    setShowMiniMap: s.setShowMiniMap,
    showSnapshots: s.showSnapshots,
    setShowSnapshots: s.setShowSnapshots,
    showHeatmap: s.showHeatmap,
    churnData: s.churnData,
    setChurnData: s.setChurnData,
    refactorTarget: s.refactorTarget,
    setRefactorTarget: s.setRefactorTarget,
    selectedNode: s.selectedNode,
    setSelectedNode: s.setSelectedNode,
    setPropTrace: s.setPropTrace,
    setDiffOverlay: s.setDiffOverlay,
  })));

  // ─── Graph Layout ────────────────────────────────────────────
  const { flowEdges, enrichedFlowNodes, onNodesChange, onEdgesChange } = useGraphLayout({
    rawGraphData,
    enrichmentMap,
    onDeleteNode: handleDeleteNode,
    workspacePath: selectedPath,
  });

  // ─── Keyboard Shortcut ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(!useAppStore.getState().showCommandPalette);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Global Menu Actions ─────────────────────────────────────
  useEffect(() => {
    const handleAppAction = (e: Event) => {
      const action = (e as CustomEvent).detail;
      switch (action) {
        case 'OPEN_FOLDER':
          handleSelectDirectory();
          break;
        case 'OPEN_SETTINGS':
          setShowSettings(true);
          break;
        case 'EXIT':
          import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().close());
          break;
        case 'OPEN_COMMAND_PALETTE':
          setShowCommandPalette(true);
          break;
        case 'TOGGLE_VIEW_MODE':
          useAppStore.getState().setViewMode(useAppStore.getState().viewMode === '2d' ? '3d' : '2d');
          break;
        case 'TOGGLE_MINIMAP':
          useAppStore.getState().setShowMiniMap(!useAppStore.getState().showMiniMap);
          break;
        case 'TOGGLE_EXTERNAL_DEPS':
          useAppStore.getState().setShowExternalDeps(!useAppStore.getState().showExternalDeps);
          break;
        case 'TOGGLE_HEATMAP':
          useAppStore.getState().setShowHeatmap(!useAppStore.getState().showHeatmap);
          break;
        case 'TOGGLE_SNAPSHOTS':
          useAppStore.getState().setShowSnapshots(!useAppStore.getState().showSnapshots);
          break;
        case 'TOGGLE_THEME':
          setIsLightMode(!isLightMode);
          break;
        case 'RELOAD_WINDOW':
          window.location.reload();
          break;
      }
    };
    window.addEventListener('app:action', handleAppAction);
    return () => window.removeEventListener('app:action', handleAppAction);
  }, [handleSelectDirectory]);

  // ─── Git Churn Fetch ──────────────────────────────────────────
  useEffect(() => {
    if (showHeatmap && !churnData && selectedPath) {
      invoke('get_git_churn', { workspace: selectedPath, limit: 100 })
        .then((data: any) => {
          const absoluteChurn: Record<string, number> = {};
          const normalizedWorkspace = selectedPath.replace(/\\/g, '/');
          for (const [key, value] of Object.entries(data)) {
            absoluteChurn[`${normalizedWorkspace}/${key}`] = value as number;
            absoluteChurn[`${selectedPath}\\${key.replace(/\//g, '\\')}`] = value as number;
          }
          setChurnData(absoluteChurn);
        })
        .catch(err => {
          console.error("Failed to fetch git churn:", err);
        });
    }
  }, [showHeatmap, selectedPath, churnData]);

  // ─── Welcome Screen ──────────────────────────────────────────
  if (!selectedPath && !isParsing) {
    return (
      <div className="flex flex-col h-screen w-screen bg-background relative overflow-hidden bg-dot-grid">
        <div className="noise-overlay" />
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-welcome-glow-1" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-600/5 rounded-full blur-3xl animate-welcome-glow-2" />
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto z-10">
          {/* Left Hero Section */}
          <div className="flex-1 flex flex-col justify-center px-12 lg:px-24 py-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-xl nebula-slide-up"
            >
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-8">
                <Sparkles className="text-white" size={28} />
              </div>
              <h1 className="text-5xl font-sans font-bold text-text-main mb-4 tracking-tight gradient-text">CodeMapper</h1>
              <p className="text-text-muted mb-10 text-lg leading-relaxed font-sans">
                Visualize your codebase architecture in stunning 2D and 3D graphs. Discover dependencies, analyze complexity, and refactor with AI-powered insights.
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectDirectory}
                  className="btn-primary flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl transition-all duration-200 font-semibold cursor-pointer"
                >
                  <FolderOpen size={20} />
                  <span>Open Project Folder</span>
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-6 py-4 rounded-xl font-semibold text-text-main bg-surface hover:bg-surface-raised border border-border transition-all duration-200 cursor-pointer"
                >
                  Settings
                </button>
                <button
                  onClick={() => alert('Demo Repo feature coming in v1.1!')}
                  className="px-6 py-4 rounded-xl font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all duration-200 cursor-pointer"
                >
                  Try Sample Repo
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Recent Projects Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="w-full md:w-[400px] lg:w-[500px] border-t md:border-t-0 md:border-l border-border bg-surface/30 backdrop-blur-md flex flex-col px-8 py-12"
          >
            <div className="flex items-center gap-3 mb-8">
              <Clock size={16} className="text-blue-400" />
              <h2 className="text-lg font-semibold text-text-main tracking-tight">Recent Projects</h2>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {recentProjects.length === 0 ? (
                <div className="text-sm text-text-muted italic bg-surface/50 rounded-xl p-6 border border-border-subtle text-center">
                  No recent projects found. Open a folder to get started.
                </div>
              ) : (
                recentProjects.map((projectPath, i) => {
                  const normalized = projectPath.replace(/\\/g, '/');
                  const segments = normalized.split('/').filter(Boolean);
                  const projectName = segments[segments.length - 1] || projectPath;
                  const parentPath = segments.slice(0, -1).join('/');
                  return (
                    <button
                      key={i}
                      onClick={() => handleOpenRecentProject(projectPath)}
                      className="w-full flex items-start gap-4 p-4 rounded-xl glass-panel hover:bg-surface-raised transition-all duration-200 cursor-pointer group text-left border border-border hover:border-blue-500/30 hover:shadow-md"
                    >
                      <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-colors mt-0.5">
                        <FolderGit2 size={18} className="text-text-dim group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 gap-1">
                        <span className="text-[15px] font-semibold text-text-main truncate">{projectName}</span>
                        {parentPath && <span className="text-xs text-text-dim font-mono truncate" title={parentPath}>{parentPath}</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {showSettings && (
          <SettingsModal
            apiKey={apiKey} setApiKey={setApiKey}
            selectedModel={selectedModel} setSelectedModel={setSelectedModel}
            enableAi={enableAi} setEnableAi={setEnableAi}
            preferredIde={preferredIde} setPreferredIde={handleSetPreferredIde}
            aiProvider={aiProvider} setAiProvider={setAiProvider}
            localBaseUrl={localBaseUrl} setLocalBaseUrl={setLocalBaseUrl}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    );
  }

  // ─── Loading Screen ──────────────────────────────────────────
  if (isParsing && !selectedPath) {
    return (
      <div className="flex flex-col h-screen w-screen bg-background relative overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center nebula-slide-up">
            <div className="w-12 h-12 border-4 border-surface-raised border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-text-muted font-mono text-sm">
              {isEnriching ? 'Enriching with AI...' : 'Analyzing codebase...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Workspace ──────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text-main font-sans">
      <div className="noise-overlay" />
      <TitleBar />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />

        {activeTab === 'source-control' && <SourceControlPanel workspacePath={selectedPath} />}

        {activeTab === 'explorer' && (
          <ExplorerPanel
            nodes={enrichedFlowNodes}
            onNodeFocus={(nodeId) => {
              const node = enrichedFlowNodes.find(n => n.id.replace(/\\/g, '/').endsWith(nodeId));
              if (node) setSelectedNode(node);
            }}
            selectedNodeId={selectedNode?.id || null}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-surface-raised border-l border-border">
          <EditorToolbar />

          {selectedPath && (
            <WorkspaceBreadcrumb path={selectedPath} onChangeDirectory={handleSelectDirectory} />
          )}

          <div className="flex-1 relative overflow-hidden bg-background">
            {viewMode === '2d' && activeTab === 'network' && (
              <SearchBar />
            )}

            {viewMode === '2d' ? (
              <ReactFlowGraph
                nodes={enrichedFlowNodes}
                edges={flowEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeSelect={setSelectedNode}
                isLightMode={isLightMode}
                preferredIde={preferredIde}
              />
            ) : (
              <ThreeDGraph
                graphData={rawGraphData}
                selectedNode={selectedNode}
                onNodeSelect={setSelectedNode}
              />
            )}
          </div>

          <BottomPanel
            selectedNode={selectedNode}
            logs={logs}
            preferredIde={preferredIde}
            workspacePath={selectedPath}
            edges={flowEdges}
            onRefactorClick={setRefactorTarget}
            onPropTrace={setPropTrace}
          />
        </div>
      </div>

      <StatusBar
        workspacePath={selectedPath}
        logsCount={logs.length}
        isParsing={isParsing}
        isEnriching={isEnriching}
        preferredIde={preferredIde}
      />

      {showSettings && selectedPath && (
        <SettingsModal
          apiKey={apiKey} setApiKey={setApiKey}
          selectedModel={selectedModel} setSelectedModel={setSelectedModel}
          enableAi={enableAi} setEnableAi={setEnableAi}
          preferredIde={preferredIde}
          setPreferredIde={handleSetPreferredIde}
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          localBaseUrl={localBaseUrl}
          setLocalBaseUrl={setLocalBaseUrl}
          onClose={() => setShowSettings(false)}
        />
      )}

      {refactorTarget && selectedPath && (
        <RefactorPreview
          workspacePath={selectedPath}
          targetPath={refactorTarget}
          onClose={() => setRefactorTarget(null)}
        />
      )}

      {showSnapshots && selectedPath && (
        <SnapshotPanel
          workspacePath={selectedPath}
          graphData={rawGraphData}
          onClose={() => setShowSnapshots(false)}
          onApplyDiff={setDiffOverlay}
        />
      )}

      <AiChatModal />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onChangeDirectory={handleSelectDirectory}
        onToggleTheme={() => setIsLightMode(prev => !prev)}
        onOpenSettings={() => { setShowCommandPalette(false); setShowSettings(true); }}
        onSetViewMode={setViewMode}
        onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
        onSetLayer={setActiveLayer}
        isLightMode={isLightMode}
        viewMode={viewMode}
        showMiniMap={showMiniMap}
      />

      <InteractiveTour />
      <KeyboardShortcutsModal />
    </div>
  );
}

export default App;
