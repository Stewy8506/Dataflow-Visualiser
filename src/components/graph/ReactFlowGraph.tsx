import { useState, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  NodeTypes,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileNode } from './FileNode';
import { LayoutController } from './LayoutController';
import { calculateBlastRadius } from '../../utils/blastRadius';
import { invoke } from '@tauri-apps/api/core';

const nodeTypes: NodeTypes = {
  fileNode: FileNode,
};

interface ReactFlowGraphProps {
  nodes: any[];
  edges: any[];
  onNodeSelect: (node: any) => void;
  nodesep: number;
  setNodesep: (val: number) => void;
  ranksep: number;
  setRanksep: (val: number) => void;
  direction: 'LR' | 'TB';
  setDirection: (dir: 'LR' | 'TB') => void;
  isLightMode: boolean;
  preferredIde: string;
  searchQuery?: string;
  searchMode?: 'highlight' | 'collapse';
  showMiniMap?: boolean;
}

// ─── Inner component: needs ReactFlowProvider above it ────────
function ReactFlowInner({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeSelect,
  nodesep,
  setNodesep,
  ranksep,
  setRanksep,
  direction,
  setDirection,
  isLightMode,
  preferredIde,
  searchQuery,
  searchMode,
  showMiniMap,
}: ReactFlowGraphProps) {
  const { zoomTo, getZoom } = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const activeNodeId = selectedNodeId;

  // ── Smooth zoom ────────────────────────────────────────────────
  // Strategy: accumulate wheel deltas into a single target, then fire
  // one zoomTo(target, { duration: 500 }) per animation frame.
  // d3-zoom correctly interpolates from the current mid-animation position,
  // giving a natural ease-in (while scrolling) and ease-out (after stop).
  const targetZoomRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Build on the last intended target so fast scrolling accumulates correctly
    const base = targetZoomRef.current ?? getZoom();
    const sensitivity = 0.001;
    targetZoomRef.current = Math.min(4, Math.max(0.05, base * Math.exp(-e.deltaY * sensitivity)));

    // Batch all deltas that arrive in the same frame into one zoomTo call
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const target = targetZoomRef.current;
      if (target !== null) {
        // 500ms lets us see both the ease-in (scroll start) and ease-out (scroll stop) tails
        zoomTo(target, { duration: 300 });
      }
      // Keep targetZoomRef so next wheel event uses it as base (correct during in-flight animation)
    });
  }, [zoomTo, getZoom]);

  // ── Blast radius ────────────────────────────────────────────────
  const blastRadius = useMemo(() => {
    if (!activeNodeId) return null;
    return calculateBlastRadius(activeNodeId, initialEdges);
  }, [activeNodeId, initialEdges]);

  // ── Styled nodes (memoized — no setState, no double-render) ────
  const styledNodes = useMemo(() => {
    return initialNodes.map(node => {
      let isConnected = true;
      let tier = -1;

      if (blastRadius) {
        if (blastRadius.tiers.has(node.id)) {
          tier = blastRadius.tiers.get(node.id)!;
        } else {
          isConnected = false;
        }
      }

      let isSearchMatch = true;
      if (searchQuery && searchMode === 'highlight') {
         const query = searchQuery.toLowerCase();
         const semanticGroup = node.data.semantic_group || '';
         const summary = node.data.summary || '';
         isSearchMatch = node.id.toLowerCase().includes(query) || 
                         node.data.label.toLowerCase().includes(query) ||
                         semanticGroup.toLowerCase().includes(query) ||
                         summary.toLowerCase().includes(query);
      }

      const isSelected = selectedNodeId === node.id;

      return {
        ...node,
        selected: isSelected,
        data: {
          ...node.data,
          blastTier: tier,
          blastConnected: isConnected,
          hasBlastRadius: !!blastRadius,
          isSearchMatch,
        },
        style: {
          ...node.style,
          opacity: (isConnected && isSearchMatch) ? 1 : 0.15,
          pointerEvents: (isConnected && isSearchMatch) ? 'all' : 'none',
        }
      };
    });
  }, [initialNodes, blastRadius, selectedNodeId, searchQuery, searchMode]);

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
      if (blastRadius && isConnected) {
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
        style: {
          ...edge.style,
          opacity: noActiveNode ? 0.6 : (isConnected ? 0.9 : 0.04),
          strokeWidth: isDirectlyConnected ? 3 : (isConnected ? 2 : 1.5),
          stroke: strokeColor,
        },
        markerEnd,
        animated: isDirectlyConnected && !!blastRadius,
      };
    });
  }, [initialEdges, blastRadius, activeNodeId, isLightMode]);

  const handleNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
    onNodeSelect(node);
  };

  const handleNodeDoubleClick = (_: React.MouseEvent, node: any) => {
    if (blastRadius && node.id) {
       invoke("open_in_ide", { path: node.id, ide: preferredIde }).catch(console.error);
    }
  };

  const handlePaneClick = () => {
    setSelectedNodeId(null);
    onNodeSelect(null);
  };


  return (
    <div className="w-full h-full bg-background relative" onWheel={handleWheel}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        colorMode={isLightMode ? "light" : "dark"}
        fitView
        minZoom={0.05}
        maxZoom={4}
        zoomOnScroll={false}
        zoomOnPinch={true}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        className="codebase-flow"
        proOptions={{ hideAttribution: true }}
      >
        <Background color={isLightMode ? "#cbd5e1" : "#475569"} gap={20} size={1.5} variant={BackgroundVariant.Dots} />
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
      <LayoutController
        nodesep={nodesep}
        setNodesep={setNodesep}
        ranksep={ranksep}
        setRanksep={setRanksep}
        direction={direction}
        setDirection={setDirection}
      />
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
