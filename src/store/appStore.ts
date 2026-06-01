import { create } from 'zustand';
import { ViewMode, GraphLayer, ActiveTab, SearchMode, LayoutDirection, SnapshotDiff } from '../types';

interface AppState {
  viewMode: ViewMode;
  activeLayer: GraphLayer;
  activeTab: ActiveTab;
  selectedNode: any | null;
  showSettings: boolean;
  showCommandPalette: boolean;
  showMiniMap: boolean;
  showExternalDeps: boolean;
  showSnapshots: boolean;
  showHeatmap: boolean;
  showTests: boolean;
  showSemanticEdges: boolean;
  churnData: Record<string, number> | null;
  refactorTarget: string | null;
  propTrace: any | null;
  diffOverlay: SnapshotDiff | null;
  nodesep: number;
  ranksep: number;
  layoutDirection: LayoutDirection;
  searchQuery: string;
  searchMode: SearchMode;
  customFilters: string;
  showAiChat: boolean;

  setViewMode: (mode: ViewMode) => void;
  setActiveLayer: (layer: GraphLayer) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedNode: (node: any | null) => void;
  setShowSettings: (show: boolean) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowMiniMap: (show: boolean) => void;
  setShowExternalDeps: (show: boolean) => void;
  setShowSnapshots: (show: boolean) => void;
  setShowHeatmap: (show: boolean) => void;
  setShowTests: (show: boolean) => void;
  setShowSemanticEdges: (show: boolean) => void;
  setChurnData: (data: Record<string, number> | null) => void;
  setRefactorTarget: (target: string | null) => void;
  setPropTrace: (trace: any | null) => void;
  setDiffOverlay: (diff: SnapshotDiff | null) => void;
  setNodesep: (sep: number) => void;
  setRanksep: (sep: number) => void;
  setLayoutDirection: (dir: LayoutDirection) => void;
  setSearchQuery: (query: string) => void;
  setSearchMode: (mode: SearchMode) => void;
  setCustomFilters: (filters: string) => void;
  setShowAiChat: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  viewMode: '2d',
  activeLayer: 'overall',
  activeTab: 'network',
  selectedNode: null,
  showSettings: false,
  showCommandPalette: false,
  showMiniMap: false,
  showExternalDeps: false,
  showSnapshots: false,
  showHeatmap: false,
  showTests: true,
  showSemanticEdges: true,
  churnData: null,
  refactorTarget: null,
  propTrace: null,
  diffOverlay: null,
  nodesep: 70,
  ranksep: 400,
  layoutDirection: 'TB',
  searchQuery: '',
  searchMode: 'highlight',
  customFilters: '',
  showAiChat: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setShowSettings: (show) => set({ showSettings: show }),
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
  setShowMiniMap: (show) => set({ showMiniMap: show }),
  setShowExternalDeps: (show) => set({ showExternalDeps: show }),
  setShowSnapshots: (show) => set({ showSnapshots: show }),
  setShowHeatmap: (show) => set({ showHeatmap: show }),
  setShowTests: (show) => set({ showTests: show }),
  setShowSemanticEdges: (show) => set({ showSemanticEdges: show }),
  setChurnData: (data) => set({ churnData: data }),
  setRefactorTarget: (target) => set({ refactorTarget: target }),
  setPropTrace: (trace) => set({ propTrace: trace }),
  setDiffOverlay: (diff) => set({ diffOverlay: diff }),
  setNodesep: (sep) => set({ nodesep: sep }),
  setRanksep: (sep) => set({ ranksep: sep }),
  setLayoutDirection: (dir) => set({ layoutDirection: dir }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  setCustomFilters: (filters) => set({ customFilters: filters }),
  setShowAiChat: (show) => set({ showAiChat: show }),
}));
