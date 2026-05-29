import { useState, useEffect } from 'react';
import { FolderOpen, Sparkles, Clock, FolderGit2 } from 'lucide-react';
import './App.css';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
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
import { SnapshotPanel, SnapshotDiff } from './features/snapshots/SnapshotPanel';
import { invoke } from '@tauri-apps/api/core';

// Hooks
import { useSettings } from './hooks/useSettings';
import { useProjectLoader } from './hooks/useProjectLoader';
import { useGraphLayout } from './hooks/useGraphLayout';

// Types
import type { GraphLayer, ViewMode, ActiveTab, SearchMode } from './types';

function App() {
  // ─── Settings ────────────────────────────────────────────────
  const {
    apiKey, setApiKey,
    selectedModel, setSelectedModel,
    enableAi, setEnableAi,
    isLightMode, setIsLightMode,
    preferredIde,
    handleSetPreferredIde,
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
  } = useProjectLoader({ apiKey, enableAi, selectedModel });

  // ─── UI State ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [activeLayer, setActiveLayer] = useState<GraphLayer>('overall');
  const [activeTab, setActiveTab] = useState<ActiveTab>('network');
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [showExternalDeps, setShowExternalDeps] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [churnData, setChurnData] = useState<Record<string, number> | null>(null);
  const [refactorTarget, setRefactorTarget] = useState<string | null>(null);
  const [propTrace, setPropTrace] = useState<any | null>(null);
  const [diffOverlay, setDiffOverlay] = useState<SnapshotDiff | null>(null);
  const [nodesep, setNodesep] = useState(70);
  const [ranksep, setRanksep] = useState(400);
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('TB');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('highlight');

  // ─── Graph Layout ────────────────────────────────────────────
  const { flowEdges, enrichedFlowNodes, onNodesChange, onEdgesChange } = useGraphLayout({
    rawGraphData,
    activeLayer,
    layoutDirection,
    nodesep,
    ranksep,
    searchQuery,
    searchMode,
    enrichmentMap,
    showExternalDeps,
    onDeleteNode: handleDeleteNode,
    workspacePath: selectedPath,
  });

  // ─── Keyboard Shortcut ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      <div className="flex h-screen w-screen items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-welcome-glow-1" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-welcome-glow-2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/[0.02] rounded-full blur-3xl animate-welcome-glow-3" />
        </div>

        <div className="z-10 flex flex-col items-center max-w-lg w-full px-4">
          <div className="flex flex-col items-center nebula-glass p-10 rounded-2xl w-full text-center shadow-2xl nebula-slide-up">
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

          {recentProjects.length > 0 && (
            <div className="w-full mt-4 nebula-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <Clock size={12} className="text-text-dim" />
                <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">Recent Projects</span>
              </div>
              <div className="space-y-1.5">
                {recentProjects.map((projectPath, i) => {
                  const normalized = projectPath.replace(/\\/g, '/');
                  const segments = normalized.split('/').filter(Boolean);
                  const projectName = segments[segments.length - 1] || projectPath;
                  const parentPath = segments.slice(-3, -1).join('/');
                  return (
                    <button
                      key={i}
                      onClick={() => handleOpenRecentProject(projectPath)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass-panel hover:bg-surface-raised/80 transition-all duration-200 cursor-pointer group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0 group-hover:border-blue-500/30 transition-colors">
                        <FolderGit2 size={14} className="text-text-dim group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-text-main truncate">{projectName}</span>
                        {parentPath && <span className="text-[10px] text-text-dim font-mono truncate">{parentPath}/</span>}
                      </div>
                      <FolderOpen size={14} className="text-text-dim/0 group-hover:text-text-dim transition-all shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

  // ─── Loading Screen ──────────────────────────────────────────
  if (isParsing && !selectedPath) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center nebula-slide-up">
          <div className="w-12 h-12 border-4 border-surface-raised border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-text-muted font-mono text-sm">
            {isEnriching ? 'Enriching with AI...' : 'Analyzing codebase...'}
          </p>
        </div>
      </div>
    );
  }

  // ─── Main Workspace ──────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background relative text-text-main font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

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

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 relative overflow-hidden bg-background">
          <Header
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            onSettingsClick={() => setShowSettings(true)}
            onChangeDirectory={handleSelectDirectory}
            isLightMode={isLightMode}
            setIsLightMode={setIsLightMode}
            showMiniMap={showMiniMap}
            setShowMiniMap={setShowMiniMap}
            showExternalDeps={showExternalDeps}
            setShowExternalDeps={setShowExternalDeps}
            showSnapshots={showSnapshots}
            setShowSnapshots={setShowSnapshots}
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
          />

          {selectedPath && (
            <WorkspaceBreadcrumb path={selectedPath} onChangeDirectory={handleSelectDirectory} />
          )}

          {viewMode === '2d' && activeTab === 'network' && (
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchMode={searchMode}
              setSearchMode={setSearchMode}
            />
          )}

          {viewMode === '2d' ? (
            <ReactFlowGraph
              nodes={enrichedFlowNodes}
              edges={flowEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeSelect={setSelectedNode}
              nodesep={nodesep}
              setNodesep={setNodesep}
              ranksep={ranksep}
              setRanksep={setRanksep}
              direction={layoutDirection}
              setDirection={setLayoutDirection}
              isLightMode={isLightMode}
              preferredIde={preferredIde}
              searchQuery={searchQuery}
              searchMode={searchMode}
              showMiniMap={showMiniMap}
              propTrace={propTrace}
              diffOverlay={diffOverlay}
              churnData={showHeatmap ? churnData : null}
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

      {showSettings && selectedPath && (
        <SettingsModal
          apiKey={apiKey} setApiKey={setApiKey}
          selectedModel={selectedModel} setSelectedModel={setSelectedModel}
          enableAi={enableAi} setEnableAi={setEnableAi}
          preferredIde={preferredIde} setPreferredIde={handleSetPreferredIde}
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

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onChangeDirectory={handleSelectDirectory}
        onToggleTheme={() => setIsLightMode(prev => !prev)}
        onOpenSettings={() => { setShowCommandPalette(false); setShowSettings(true); }}
        onSetViewMode={setViewMode}
        onToggleMiniMap={() => setShowMiniMap(prev => !prev)}
        onSetLayer={setActiveLayer}
        isLightMode={isLightMode}
        viewMode={viewMode}
        showMiniMap={showMiniMap}
      />
    </div>
  );
}

export default App;
