import { useEffect, useRef } from 'react';
import { FolderOpen, Clock } from 'lucide-react';
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
  const settings = useSettings();
  const {
    apiKey,
    selectedModel,
    enableAi,
    isLightMode, setIsLightMode,
    preferredIde,
    aiProvider,
    localBaseUrl,
    startupBehavior,
  } = settings;
  const didAttemptStartupRestore = useRef(false);

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
  } = useProjectLoader({ 
    apiKey, 
    enableAi, 
    selectedModel, 
    aiProvider, 
    localBaseUrl,
    aiTemperature: settings.aiTemperature,
    customSummaryPrompt: settings.customSummaryPrompt
  });

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
    showTestCoverage,
    testCoverageData,
    setTestCoverageData,
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
    showTestCoverage: s.showTestCoverage,
    testCoverageData: s.testCoverageData,
    setTestCoverageData: s.setTestCoverageData,
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
      const matchShortcut = (shortcutStr: string) => {
        if (!shortcutStr) return false;
        const parts = shortcutStr.toLowerCase().split('+');
        const needsCtrl = parts.includes('ctrl');
        const needsMeta = parts.includes('meta');
        const needsAlt = parts.includes('alt');
        const needsShift = parts.includes('shift');
        
        if (needsCtrl !== e.ctrlKey) return false;
        if (needsMeta !== e.metaKey) return false;
        if (needsAlt !== e.altKey) return false;
        if (needsShift !== e.shiftKey) return false;
        
        const mainKey = parts.find(p => !['ctrl', 'meta', 'alt', 'shift'].includes(p));
        let eventKey = e.key.toLowerCase();
        if (eventKey === ' ') eventKey = 'space';
        return eventKey === mainKey;
      };

      const bindings = settings.keybindings || {};
      
      if (matchShortcut(bindings.commandPalette)) {
        e.preventDefault();
        setShowCommandPalette(!useAppStore.getState().showCommandPalette);
      } else if (matchShortcut(bindings.searchNodes)) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      } else if (matchShortcut(bindings.toggleSettings)) {
        e.preventDefault();
        setShowSettings(!showSettings);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.keybindings, showSettings, setShowSettings, setShowCommandPalette]);

  // ─── Tauri Window Size & Fullscreen Controller ────────────────
  useEffect(() => {
    if (
      didAttemptStartupRestore.current ||
      startupBehavior !== 'restore' ||
      selectedPath ||
      isParsing ||
      recentProjects.length === 0
    ) {
      return;
    }
    didAttemptStartupRestore.current = true;
    handleOpenRecentProject(recentProjects[0]);
  }, [startupBehavior, selectedPath, isParsing, recentProjects, handleOpenRecentProject]);

  useEffect(() => {
    const handleWindowResize = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { LogicalSize } = await import('@tauri-apps/api/dpi');
        const appWindow = getCurrentWindow();

        if (!selectedPath) {
          // Landing page: unmaximize, resize to 900x600, and center
          await appWindow.unmaximize();
          await appWindow.setSize(new LogicalSize(900, 600));
          await appWindow.center();
        } else {
          // Repo opened: maximize (retaining OS title bar/buttons)
          await appWindow.maximize();
        }
      } catch (e) {
        console.warn('Tauri window API not available or failed:', e);
      }
    };
    handleWindowResize();
  }, [selectedPath]);

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
        case 'TOGGLE_TEST_COVERAGE':
          useAppStore.getState().setShowTestCoverage(!useAppStore.getState().showTestCoverage);
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
      invoke('get_git_churn', { workspace: selectedPath, limit: settings.gitHistoryLimit || 100 })
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
  }, [showHeatmap, selectedPath, churnData, settings.gitHistoryLimit]);

  // ─── Test Coverage Fetch ─────────────────────────────────────────
  useEffect(() => {
    if (showTestCoverage && !testCoverageData && selectedPath) {
      invoke('compute_test_coverage', { workspace: selectedPath })
        .then((data: any) => {
          setTestCoverageData(data);
        })
        .catch(err => {
          console.error("Failed to fetch test coverage:", err);
        });
    }
  }, [showTestCoverage, selectedPath, testCoverageData]);

  // ─── Welcome Screen ──────────────────────────────────────────
  if (!selectedPath && !isParsing) {
    return (
      <div className="flex flex-col h-screen w-screen bg-background relative overflow-hidden bg-dot-grid">
        <div className="noise-overlay" />

        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto z-10">
          {/* Left Hero Section */}
          <div className="flex-1 flex flex-col justify-center px-12 lg:px-24 py-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-xl nebula-slide-up"
            >
              <div className="mb-6 text-zinc-500 font-mono text-[11px] tracking-widest uppercase">
                / codebase mapper
              </div>
              <h1 className="text-6xl font-serif italic font-normal text-white mb-4 tracking-tight">
                Dataflow Visualiser
              </h1>
              <p className="text-zinc-400 mb-8 text-base leading-relaxed font-sans font-light max-w-sm">
                Visualize codebase architecture, mapping file dependencies and components in a clean, spatial view.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectDirectory}
                  className="btn-primary flex items-center justify-center gap-2.5 bg-white hover:bg-zinc-200 text-zinc-950 px-6 py-3.5 rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer border border-white"
                >
                  <FolderOpen size={16} />
                  <span>Open Folder</span>
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-5 py-3.5 rounded-lg text-sm font-medium text-zinc-300 bg-transparent hover:bg-zinc-900 border border-zinc-800 transition-all duration-200 cursor-pointer"
                >
                  Settings
                </button>
                <button
                  onClick={() => handleOpenRecentProject('https://github.com/microsoft/vscode')}
                  className="px-5 py-3.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-450 bg-transparent hover:bg-zinc-900 border border-zinc-800/60 transition-all duration-200 cursor-pointer"
                >
                  Demo Repo
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Recent Projects Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="w-full md:w-[350px] lg:w-[400px] border-t md:border-t-0 md:border-l border-zinc-900 bg-zinc-950/40 backdrop-blur-md flex flex-col px-8 py-12"
          >
            <div className="flex items-center gap-2 mb-6">
              <Clock size={14} className="text-zinc-500" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Recent Projects</h2>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-1">
              {recentProjects.length === 0 ? (
                <div className="text-xs font-mono text-zinc-600 bg-zinc-900/10 rounded-lg p-6 border border-zinc-900 text-center">
                  No recent projects. Open a folder to begin.
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
                      className="w-full flex items-center justify-between py-3.5 border-b border-zinc-900/60 hover:border-zinc-700 transition-all duration-200 cursor-pointer group text-left"
                    >
                      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[14px] font-medium text-zinc-200 group-hover:text-white transition-colors truncate">{projectName}</span>
                        {parentPath && <span className="text-[10px] text-zinc-600 font-mono truncate" title={parentPath}>{parentPath}</span>}
                      </div>
                      <div className="text-zinc-700 group-hover:text-zinc-300 transition-colors ml-2 font-mono text-xs">
                        &rarr;
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
            settings={settings}
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
                workspacePath={selectedPath!}
                settings={settings}
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
          settings={settings}
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

      <AiChatModal workspacePath={selectedPath} />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onChangeDirectory={handleSelectDirectory}
        onToggleTheme={() => setIsLightMode(!isLightMode)}
        onOpenSettings={() => { setShowCommandPalette(false); setShowSettings(true); }}
        onSetViewMode={setViewMode}
        onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
        onSetLayer={setActiveLayer}
        isLightMode={isLightMode}
        viewMode={viewMode}
        showMiniMap={showMiniMap}
        nodes={enrichedFlowNodes}
        onSelectNode={setSelectedNode}
      />

      <InteractiveTour />
      <KeyboardShortcutsModal />
    </div>
  );
}

export default App;
