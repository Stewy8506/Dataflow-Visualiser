import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BarChart3, Activity, ChevronLeft } from 'lucide-react';

import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  NodeTypes,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileNode } from './FileNode';
import { PreviewNode } from './PreviewNode';
import { LayoutController } from './LayoutController';
import { GraphLegend } from './GraphLegend';
import { calculateBlastRadius } from '../../utils/blastRadius';
import { detectCycles } from '../../utils/cycleDetection';
import { invoke } from '@tauri-apps/api/core';
import { toPng } from 'html-to-image';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const nodeTypes: NodeTypes = {
  fileNode: FileNode,
  previewNode: PreviewNode,
};

import { useSettings } from '../../hooks/useSettings';

interface ReactFlowGraphProps {
  nodes: any[];
  edges: any[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeSelect: (node: any) => void;
  isLightMode: boolean;
  preferredIde: string;
  workspacePath: string;
  settings: ReturnType<typeof useSettings>;
}

// ─── Inner component: needs ReactFlowProvider above it ────────
import { useAppStore } from '../../store/appStore';
import { useShallow } from 'zustand/react/shallow';

function ReactFlowInner({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  isLightMode,
  preferredIde,
  workspacePath,
  settings,
}: ReactFlowGraphProps) {
  const { zoomTo, getZoom, setCenter, getNodes } = useReactFlow();

  const {
    searchQuery,
    searchMode,
    showMiniMap,
    propTrace,
    diffOverlay,
    churnData,
    showHeatmap,
    showTestCoverage,
    testCoverageData,
    selectedNode,
    setSelectedNode,
  } = useAppStore(useShallow((s) => ({
    searchQuery: s.searchQuery,
    searchMode: s.searchMode,
    showMiniMap: s.showMiniMap,
    propTrace: s.propTrace,
    diffOverlay: s.diffOverlay,
    churnData: s.churnData,
    showHeatmap: s.showHeatmap,
    showTestCoverage: s.showTestCoverage,
    testCoverageData: s.testCoverageData,
    selectedNode: s.selectedNode,
    setSelectedNode: s.setSelectedNode,
  })));

  const effectiveChurnData = showHeatmap ? churnData : null;
  const activeNodeId = selectedNode?.id || null;

  // ── Sync and center selected node from store ─────────────────
  useEffect(() => {
    if (selectedNode?.id) {
      const flowNodes = getNodes();
      const node = flowNodes.find(n => n.id === selectedNode.id);
      if (node && node.position) {
        setCenter(
          node.position.x + (node.measured?.width ?? 150) / 2,
          node.position.y + (node.measured?.height ?? 80) / 2,
          { zoom: 1.2, duration: 800 }
        );
      }
    }
  }, [selectedNode?.id, setCenter, getNodes]);

  // ── Smooth zoom ────────────────────────────────────────────────
  const targetZoomRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const base = targetZoomRef.current ?? getZoom();
    const sensitivity = 0.001;
    targetZoomRef.current = Math.min(4, Math.max(0.05, base * Math.exp(-e.deltaY * sensitivity)));

    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const target = targetZoomRef.current;
      if (target !== null) {
        zoomTo(target, { duration: 300 });
      }
    });
  }, [zoomTo, getZoom]);

  // ── Blast radius ────────────────────────────────────────────────
  const blastRadius = useMemo(() => {
    if (!activeNodeId) return null;
    return calculateBlastRadius(activeNodeId, initialEdges);
  }, [activeNodeId, initialEdges]);

  // ── Circular Dependencies ───────────────────────────────────────
  const cycleResult = useMemo(() => {
    return detectCycles(initialEdges);
  }, [initialEdges]);

  // ── Metrics Calculation ──────────────────────────────────────
  const workspaceNodes = useMemo(() => {
    return initialNodes.filter(node => !node.id.startsWith('ext:'));
  }, [initialNodes]);

  const deadCodePercent = useMemo(() => {
    if (workspaceNodes.length === 0) return 0;
    const importedNodeIds = new Set(
      initialEdges.map(e => e.data?.originalTarget || e.source).filter(Boolean)
    );
    const entryPoints = ['main', 'index', 'app', 'vite.config', 'tailwind.config'];
    const deadNodes = workspaceNodes.filter(node => {
      const labelLower = node.data?.label?.toLowerCase() || '';
      const isEntry = entryPoints.some(ep => labelLower.startsWith(ep));
      return !importedNodeIds.has(node.id) && !isEntry;
    });
    return Math.round((deadNodes.length / workspaceNodes.length) * 100);
  }, [workspaceNodes, initialEdges]);

  const languageStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let totalCount = 0;
    workspaceNodes.forEach(node => {
      const ext = node.id.split('.').pop()?.toLowerCase() || 'other';
      stats[ext] = (stats[ext] || 0) + 1;
      totalCount++;
    });
    return Object.entries(stats)
      .map(([ext, count]) => ({
        ext: ext.toUpperCase(),
        count,
        percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [workspaceNodes]);

  const getLanguageColor = (ext: string) => {
    switch (ext) {
      case 'TSX': return 'bg-blue-500';
      case 'TS': return 'bg-sky-400';
      case 'JSX': return 'bg-amber-400';
      case 'JS': return 'bg-yellow-400';
      case 'RS': return 'bg-orange-500';
      case 'PY': return 'bg-emerald-500';
      default: return 'bg-indigo-400';
    }
  };


  // ── Styled nodes (memoized — no setState, no double-render) ────
  const styledNodes = useMemo(() => {
    return initialNodes.map(node => {
      let isConnected = true;
      let tier = -1;
      let diffStatus: 'added' | 'removed' | null = null;
      
      let coverageData = null;
      if (showTestCoverage && testCoverageData) {
        // Find coverage data by path. The map keys might have different path separators or base paths.
        // Try a strict match first, then a suffix match.
        const normalizedNodeId = node.id.replace(/\\/g, '/');
        if (testCoverageData[normalizedNodeId]) {
          coverageData = testCoverageData[normalizedNodeId];
        } else {
           const matchKey = Object.keys(testCoverageData).find(k => {
              const kNorm = k.replace(/\\/g, '/');
              return kNorm.endsWith(normalizedNodeId) || normalizedNodeId.endsWith(kNorm);
           });
           if (matchKey) {
             coverageData = testCoverageData[matchKey];
           }
        }
      }

      if (diffOverlay) {
        if (diffOverlay.added_nodes.includes(node.id)) {
          diffStatus = 'added';
        } else if (diffOverlay.removed_nodes.includes(node.id)) {
          diffStatus = 'removed';
        }
      }

      if (propTrace && propTrace.involved_files) {
        const nodePath = node.data?.path?.replace(/\\/g, '/');
        const isParticipating = propTrace.involved_files.some((f: string) => f.replace(/\\/g, '/') === nodePath);
        
        // Let the node handle its own dimming state via props
        if (!isParticipating) {
          node.data = { ...node.data, isDimmed: true };
        }
      } if (blastRadius && !propTrace) {
        if (blastRadius.tiers.has(node.id)) {
          tier = blastRadius.tiers.get(node.id)!;
        } else {
          isConnected = false;
        }
      }

      // Ensure workspacePath, coverage, scale, and custom commands are passed down to all node data
      node.data = { 
        ...node.data, 
        workspacePath, 
        coverageData,
        defaultNodeScale: settings.defaultNodeScale,
        preferredIde: settings.preferredIde,
        customIdeCommand: settings.customIdeCommand,
        showDeleteConfirmation: settings.showDeleteConfirmation
      };

      let isSearchMatch = true;
      if (searchQuery) {
         const query = searchQuery.toLowerCase().trim();
         const isInCycle = cycleResult.nodesInCycles.has(node.id);
         if (query === '[tsx]') {
           isSearchMatch = node.id.toLowerCase().endsWith('.tsx') || node.data.label.toLowerCase().endsWith('.tsx');
         } else if (query === '[backend]') {
           isSearchMatch = node.id.toLowerCase().endsWith('.rs') || node.id.toLowerCase().includes('/backend/') || node.id.toLowerCase().includes('/src-tauri/') || node.data.layer === 'backend';
         } else if (query === '[external]') {
           isSearchMatch = node.id.toLowerCase().startsWith('ext:') || !!node.data.isExternal;
         } else if (query === '[circular]') {
           isSearchMatch = isInCycle;
         } else if (query === '[unused]') {
           const importedNodeIds = new Set(
             initialEdges.map(e => e.data?.originalTarget || e.source).filter(Boolean)
           );
           isSearchMatch = !importedNodeIds.has(node.id) && !['main', 'index', 'app', 'vite.config', 'tailwind.config'].some(ep => node.data?.label?.toLowerCase().startsWith(ep));
         } else if (searchMode === 'highlight' || searchMode === 'collapse') {
           const semanticGroup = node.data.semantic_group || '';
           const summary = node.data.summary || '';
           isSearchMatch = node.id.toLowerCase().includes(query) || 
                           node.data.label.toLowerCase().includes(query) ||
                           semanticGroup.toLowerCase().includes(query) ||
                           summary.toLowerCase().includes(query);
         }
      }

      const isSelected = activeNodeId === node.id;
      const isInCycle = cycleResult.nodesInCycles.has(node.id);

      let churnCount = 0;
      if (effectiveChurnData) {
         const nodePath = node.data?.path?.replace(/\\/g, '/');
         churnCount = effectiveChurnData[nodePath] || 0;
      }

      const shouldHide = searchMode === 'collapse' && searchQuery && !isSearchMatch;

      return {
        ...node,
        selected: isSelected,
        data: {
          ...node.data,
          blastTier: tier,
          blastConnected: isConnected,
          hasBlastRadius: !!blastRadius,
          isSearchMatch,
          isInCycle,
          diffStatus,
          churnCount,
        },
        style: {
          ...node.style,
          opacity: shouldHide ? 0 : (isConnected && isSearchMatch) ? 1 : 0.15,
          pointerEvents: shouldHide || !(isConnected && isSearchMatch) ? 'none' : 'all',
          ...(shouldHide ? { display: 'none' } : {}),
        }
      };
    });
  }, [initialNodes, blastRadius, activeNodeId, searchQuery, searchMode, propTrace, diffOverlay, effectiveChurnData, cycleResult, initialEdges]);

  // ── Styled edges (memoized) ────────────────────────────────────
  const styledEdges = useMemo(() => {
    return initialEdges.map(edge => {
      const sourceTier = blastRadius?.tiers.get(edge.source) ?? -1;
      const targetTier = blastRadius?.tiers.get(edge.target) ?? -1;

      const isConnected = sourceTier >= 0 && targetTier >= 0;
      const isOutgoing = activeNodeId === edge.source;
      const isIncoming = activeNodeId === edge.target;
      const isDirectlyConnected = isOutgoing || isIncoming;
      const noActiveNode = !activeNodeId;

      let strokeColor = isLightMode ? '#94a3b8' : '#334155';
      let strokeDasharray: string | undefined = undefined;
      let label: string | undefined = edge.label;
      let isAnimated = isConnected;

      const importer = edge.data?.originalSource || edge.source;
      const imported = edge.data?.originalTarget || edge.target;
      const isCircular = cycleResult.edgesInCycles.has(`${importer}->${imported}`);
      const isExternalEdge = edge.source.startsWith('ext:') || edge.target.startsWith('ext:');

      if (diffOverlay) {
        const isAdded = diffOverlay.added_edges.some(([s, t]: [string, string]) => s === edge.source && t === edge.target);
        if (isAdded) {
          return {
            ...edge,
            animated: true,
            label: 'Added',
            style: { ...edge.style, stroke: '#10b981', strokeWidth: 3, opacity: 1 }, // emerald-500
            markerEnd: { ...edge.markerEnd, color: '#10b981' }
          };
        }
      }

      // Prop Trace Edges
      if (propTrace && propTrace.involved_files) {
        const sourceParticipating = propTrace.involved_files.some((f: string) => f.replace(/\\/g, '/') === edge.data?.originalSource?.replace(/\\/g, '/'));
        const targetParticipating = propTrace.involved_files.some((f: string) => f.replace(/\\/g, '/') === edge.data?.originalTarget?.replace(/\\/g, '/'));
        
        if (sourceParticipating && targetParticipating) {
          return {
            ...edge,
            animated: true,
            label: `prop: ${propTrace.prop_name}`,
            style: {
              ...edge.style,
              stroke: '#06b6d4', // cyan-500
              strokeWidth: 3,
              opacity: 1
            },
            markerEnd: { ...edge.markerEnd, color: '#06b6d4' }
          };
        } else {
          return {
            ...edge,
            style: { ...edge.style, stroke: '#475569', opacity: 0.1 }
          };
        }
      }

      if (isCircular) {
        strokeColor = '#f43f5e';
        strokeDasharray = '8 4';
        isAnimated = true;
        label = '⚠ Circular';
      } else if (isExternalEdge) {
        strokeColor = isLightMode ? '#c026d3' : '#d946ef';
        strokeDasharray = '4 4';
      } else if (blastRadius && isConnected) {
        if (sourceTier >= 0 && targetTier > sourceTier) {
          if (targetTier === 1) strokeColor = '#ef4444';
          else if (targetTier === 2) strokeColor = '#f97316';
          else if (targetTier === 3) strokeColor = '#eab308';
          else strokeColor = isLightMode ? '#424242ff' : '#afaeaeff';
        } else {
          strokeColor = isLightMode ? '#7a7a7aff' : '#6e6e6eff';
        }
      }

      const markerEnd = edge.markerEnd && typeof edge.markerEnd === 'object'
        ? { ...edge.markerEnd, color: strokeColor }
        : edge.markerEnd;

      return {
        ...edge,
        type: settings.edgeType || 'bezier',
        animated: isAnimated,
        label,
        style: {
          ...edge.style,
          opacity: isExternalEdge ? (noActiveNode ? 0.4 : (isConnected ? 0.6 : 0.04)) : (noActiveNode ? 0.6 : (isConnected ? 0.9 : 0.04)),
          strokeWidth: isExternalEdge ? 1 : (isDirectlyConnected ? 3 : (isConnected ? 2 : 1.5)),
          stroke: strokeColor,
          strokeDasharray,
          animationDuration: isAnimated ? `${1 / (settings.edgeAnimationSpeed || 1)}s` : undefined,
        },
        markerEnd,
      };
    });
  }, [initialEdges, blastRadius, cycleResult, activeNodeId, isLightMode, propTrace, diffOverlay, settings.edgeType, settings.edgeAnimationSpeed]);

  const handleNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNode(node);
    onNodeSelect(node);
  };

  const handleNodeDoubleClick = (_: React.MouseEvent, node: any) => {
    if (node.id) {
       const ideCmd = settings.customIdeCommand || settings.preferredIde || preferredIde;
       invoke("open_in_ide", { path: node.id, ide: ideCmd }).catch(console.error);
    }
  };

  const handlePaneClick = () => {
    setSelectedNode(null);
    onNodeSelect(null);
  };

  const handleExportPng = useCallback(async () => {
    const flowElement = document.querySelector('.codebase-flow') as HTMLElement;
    if (!flowElement) return;
    try {
      const dataUrl = await toPng(flowElement, { 
          backgroundColor: isLightMode ? '#f8fafc' : '#0f0f14',
          quality: 1,
      });
      const savePath = await save({
        filters: [{ name: 'Image', extensions: ['png'] }],
        defaultPath: 'dataflow-export.png',
      });
      if (savePath) {
        const base64Data = dataUrl.split(',')[1];
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
           bytes[i] = binaryString.charCodeAt(i);
        }
        await writeFile(savePath, bytes);
      }
    } catch (err) {
      console.error("Failed to export graph", err);
    }
  }, [isLightMode]);


  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  return (
    <div className="w-full h-full bg-background relative" onWheel={handleWheel}>
      {/* Expandable Stats Panel Overlay */}
      <div className="absolute left-4 top-4 z-20 transition-all duration-300">
        {!isStatsExpanded ? (
          <button
            onClick={() => setIsStatsExpanded(true)}
            className="w-10 h-10 rounded-xl bg-surface/90 hover:bg-surface-raised border border-border shadow-lg flex items-center justify-center cursor-pointer transition-colors text-text-dim hover:text-text-main"
            title="Show Codebase Metrics"
          >
            <BarChart3 size={18} />
          </button>
        ) : (
          <div className="w-72 bg-surface/95 backdrop-blur-md border border-border rounded-xl shadow-xl p-4 flex flex-col gap-3 nebula-slide-right select-none">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-400" />
                <span className="text-xs font-bold text-text-main uppercase tracking-wider">Codebase Metrics</span>
              </div>
              <button
                onClick={() => setIsStatsExpanded(false)}
                className="p-1 text-text-dim hover:text-text-main hover:bg-surface-raised rounded transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Grid Metrics */}
            <div className="grid grid-cols-2 gap-2">
              {/* Files Count */}
              <div className="bg-background/45 border border-border/50 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-text-dim uppercase tracking-wide">Files</span>
                <span className="text-lg font-extrabold text-text-main leading-tight mt-1">{workspaceNodes.length}</span>
              </div>

              {/* Edge/Relation Count */}
              <div className="bg-background/45 border border-border/50 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-text-dim uppercase tracking-wide">Relations</span>
                <span className="text-lg font-extrabold text-text-main leading-tight mt-1">
                  {initialEdges.filter(e => !e.source.startsWith('ext:') && !e.target.startsWith('ext:')).length}
                </span>
              </div>

              {/* Cycles */}
              <div className={`border rounded-lg p-2.5 flex flex-col ${
                cycleResult.cycles.length > 0
                  ? 'bg-red-500/5 border-red-500/20 text-red-400'
                  : 'bg-background/45 border-border/50 text-text-main'
              }`}>
                <span className="text-[9px] font-bold text-text-dim uppercase tracking-wide">Circular</span>
                <span className={`text-lg font-extrabold leading-tight mt-1 ${
                  cycleResult.cycles.length > 0 ? 'text-red-400' : 'text-text-main'
                }`}>
                  {cycleResult.cycles.length}
                </span>
              </div>

              {/* Dead Code */}
              <div className={`border rounded-lg p-2.5 flex flex-col ${
                deadCodePercent > 15
                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                  : 'bg-background/45 border-border/50 text-text-main'
              }`}>
                <span className="text-[9px] font-bold text-text-dim uppercase tracking-wide">Dead Code</span>
                <span className={`text-lg font-extrabold leading-tight mt-1 ${
                  deadCodePercent > 15 ? 'text-amber-400' : 'text-text-main'
                }`}>
                  {deadCodePercent}%
                </span>
              </div>
            </div>

            {/* Language Breakdown */}
            {languageStats.length > 0 && (
              <div className="space-y-2 mt-1">
                <span className="text-[9px] font-bold text-text-dim uppercase tracking-wide">Languages</span>
                
                {/* Horizontal Stack Bar */}
                <div className="h-2 w-full bg-background rounded-full overflow-hidden flex">
                  {languageStats.map((stat) => (
                    <div
                      key={stat.ext}
                      className={getLanguageColor(stat.ext)}
                      style={{ width: `${stat.percent}%` }}
                      title={`${stat.ext}: ${stat.count} files (${stat.percent}%)`}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-text-dim">
                  {languageStats.map((stat) => (
                    <div key={stat.ext} className="flex items-center gap-1 truncate">
                      <div className={`w-1.5 h-1.5 rounded-full ${getLanguageColor(stat.ext)} shrink-0`} />
                      <span className="font-semibold text-text-main">{stat.ext}</span>
                      <span>{stat.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ReactFlow

        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        colorMode={isLightMode ? "light" : "dark"}
        fitView={settings.autoFitOnLoad}
        minZoom={0.05}
        maxZoom={4}
        zoomOnScroll={false}
        zoomOnPinch={true}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        className="codebase-flow"
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements={true}
      >
        <Background 
          color={isLightMode ? "#cbd5e1" : "#475569"} 
          gap={20} 
          size={1.5} 
          variant={
            settings.gridPattern === 'lines' ? BackgroundVariant.Lines 
            : settings.gridPattern === 'none' ? undefined 
            : BackgroundVariant.Dots
          } 
          style={settings.gridPattern === 'none' ? { display: 'none' } : { opacity: settings.gridOpacity }}
        />
        <Controls />
        {showMiniMap && (
          <MiniMap
            position="bottom-right"
            nodeColor={isLightMode ? '#94a3b8' : '#64748b'}
            maskColor={isLightMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(15, 15, 20, 0.7)'}
            style={{ 
              backgroundColor: isLightMode ? '#f8fafc' : '#1e1e2a',
              borderRadius: '8px',
              border: `1px solid ${isLightMode ? '#e2e8f0' : '#334155'}`
            }}
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      <LayoutController />
      <GraphLegend onExportPng={handleExportPng} />
    </div>
  );
}

// ─── Public export: wraps with provider so useReactFlow() works ─
export function ReactFlowGraph(props: ReactFlowGraphProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowInner {...props} />
    </ReactFlowProvider>
  );
}
