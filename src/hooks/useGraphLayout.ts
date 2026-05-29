import { useState, useEffect, useMemo } from 'react';
import { Edge, MarkerType, applyNodeChanges, NodeChange, applyEdgeChanges, EdgeChange } from '@xyflow/react';
import { getLayoutedElements } from '../utils/layout';
import type { GraphData, GraphLayer, LayoutDirection, SearchMode, EnrichmentEntry } from '../types';

interface UseGraphLayoutOptions {
  rawGraphData: GraphData | null;
  activeLayer: GraphLayer;
  layoutDirection: LayoutDirection;
  nodesep: number;
  ranksep: number;
  searchQuery: string;
  searchMode: SearchMode;
  enrichmentMap: Map<string, EnrichmentEntry>;
  showExternalDeps: boolean;
  onDeleteNode: (nodeId: string, nodePath: string) => void;
  workspacePath: string | null;
}

const DEFAULT_TOOLING_REGEX = /^(eslint|typescript|tailwindcss|postcss|autoprefixer|vite|prettier|jest|vitest|playwright|cypress|nodemon|ts-node|husky|lint-staged|react|react-dom|next|vue|svelte|@types\/.*|@eslint\/.*|@typescript-eslint\/.*|eslint-.*|@tailwindcss\/.*)$/;

export function useGraphLayout({
  rawGraphData,
  activeLayer,
  layoutDirection,
  nodesep,
  ranksep,
  searchQuery,
  searchMode,
  enrichmentMap,
  showExternalDeps,
  onDeleteNode,
  workspacePath,
}: UseGraphLayoutOptions) {
  const [flowNodes, setFlowNodes] = useState<any[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);

  // Load saved positions synchronously from localStorage
  const savedPositions = useMemo(() => {
    if (!workspacePath) return {};
    try {
      const data = localStorage.getItem(`layout-${workspacePath}`);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("Failed to parse saved positions", e);
      return {};
    }
  }, [workspacePath]);

  useEffect(() => {
    if (!rawGraphData) return;

    // Calculate in-degrees from the full unfiltered edge list to correctly detect dead code
    const inDegrees = new Map<string, number>();
    rawGraphData.edges.forEach(e => {
      inDegrees.set(e.target, (inDegrees.get(e.target) || 0) + 1);
    });

    // Filter nodes by layer and external dep settings
    let filteredRawNodes = rawGraphData.nodes.filter(n => {
      if (n.id.startsWith('ext:')) {
        if (!showExternalDeps) return false;
        const pkgName = n.id.replace('ext:', '');
        const isDefaultTooling = DEFAULT_TOOLING_REGEX.test(pkgName);
        if ((inDegrees.get(n.id) || 0) === 0 && isDefaultTooling) return false;
      }

      const isBackend = n.id.includes('/api/') || n.label.startsWith('route.') || n.id.includes('/server/') || n.id.includes('/backend/') || n.id.includes('src-tauri');
      if (activeLayer === 'ui') return !isBackend && !n.id.startsWith('ext:');
      if (activeLayer === 'backend') return isBackend && !n.id.startsWith('ext:');
      return true;
    });

    if (searchQuery && searchMode === 'collapse') {
      const query = searchQuery.toLowerCase();
      filteredRawNodes = filteredRawNodes.filter(n => {
        const enriched = enrichmentMap.get(n.id);
        const semanticGroup = enriched?.semantic_group || n.semantic_group || '';
        const summary = enriched?.summary || n.summary || '';
        return (
          n.id.toLowerCase().includes(query) ||
          n.label.toLowerCase().includes(query) ||
          semanticGroup.toLowerCase().includes(query) ||
          summary.toLowerCase().includes(query)
        );
      });
    }

    const validNodeIds = new Set(filteredRawNodes.map(n => n.id));
    const filteredRawEdges = rawGraphData.edges.filter(e =>
      validNodeIds.has(e.source) && validNodeIds.has(e.target)
    );

    const initialNodes = filteredRawNodes.map(n => {
      let subLabel = 'File';
      let isBackend = false;
      const pathLower = n.id.toLowerCase();

      if (pathLower.includes('/api/') || n.label.startsWith('route.') || pathLower.includes('controller') || pathLower.includes('handler')) {
        subLabel = 'API / Controller'; isBackend = true;
      } else if (pathLower.includes('/server/') || pathLower.includes('/backend/') || pathLower.includes('service')) {
        subLabel = 'Backend Service'; isBackend = true;
      } else if (pathLower.includes('src-tauri')) {
        subLabel = 'Rust Backend'; isBackend = true;
      } else if (['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(n.group)) {
        subLabel = 'UI Component';
      } else if (['ts', 'js', 'py', 'rs'].includes(n.group)) {
        subLabel = 'Script';
      }

      const isEntryPoint = /^(page|layout|loading|template|error|route|main|index|App|lib|app|middleware|sitemap|.*config.*|.*env.*)\./.test(n.label) || n.id.includes('src-tauri');
      const isDeadCode = (inDegrees.get(n.id) || 0) === 0 && !isEntryPoint;

      let layerIndex = 2;
      if (n.id.startsWith('ext:')) layerIndex = 4;
      else if (isBackend) layerIndex = 3;
      else if (/^(page|main|index|app)\./i.test(n.label)) layerIndex = 0;
      else if (['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(n.group)) layerIndex = 1;

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
          isExternal: n.id.startsWith('ext:'),
          semantic_group: n.semantic_group,
          summary: n.summary,
          isDeadCode,
          metrics: (n as any).metrics,
          onDelete: () => onDeleteNode(n.id, n.id),
          direction: layoutDirection,
          layerIndex,
        },
      };
    });

    const initialEdges: Edge[] = filteredRawEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.target, // Visually: imported file feeds up into importer
      target: e.source,
      type: 'default',
      animated: false,
      data: { originalSource: e.source, originalTarget: e.target },
      label: e.via ? `via ${e.via}` : undefined,
      labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#111118', fillOpacity: 0.9, stroke: '#1e1e2a', strokeWidth: 1 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 6,
      style: { stroke: '#334155', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
    }));

    const dagreEdges: Edge[] = filteredRawEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
    }));

    const { nodes: layoutedNodes } = getLayoutedElements(initialNodes, dagreEdges, layoutDirection, nodesep, ranksep);

    // Apply saved positions overriding dagre
    const nodesWithSavedPositions = layoutedNodes.map((n: any) => {
      const savedPos = savedPositions[n.id];
      if (savedPos) {
        return { ...n, position: savedPos };
      }
      return n;
    });

    const nodeById = new Map(nodesWithSavedPositions.map(n => [n.id, n]));
    const styledEdges = initialEdges.map(e => {
      const sourceNode = nodeById.get(e.source);
      const targetNode = nodeById.get(e.target);
      let sourceHandle = layoutDirection === 'TB' ? 'bottom' : 'right';
      let targetHandle = layoutDirection === 'TB' ? 'top' : 'left';

      if (sourceNode && targetNode) {
        if (layoutDirection === 'TB') {
          if (targetNode.position.y < sourceNode.position.y) {
            sourceHandle = 'top-source'; targetHandle = 'bottom-target';
          }
        } else {
          if (targetNode.position.x < sourceNode.position.x) {
            sourceHandle = 'left-source'; targetHandle = 'right-target';
          }
        }
      }
      return { ...e, sourceHandle, targetHandle };
    });

    setFlowNodes(nodesWithSavedPositions);
    setFlowEdges(styledEdges);
  }, [rawGraphData, activeLayer, layoutDirection, nodesep, ranksep, searchQuery, searchMode, enrichmentMap, showExternalDeps, onDeleteNode, savedPositions]);

  // Merge AI enrichment into nodes without triggering dagre relayout
  const enrichedFlowNodes = useMemo(() => {
    if (enrichmentMap.size === 0) return flowNodes;
    return flowNodes.map(node => {
      const enrichment = enrichmentMap.get(node.id);
      if (!enrichment) return node;
      return {
        ...node,
        data: {
          ...node.data,
          semantic_group: enrichment.semantic_group,
          summary: enrichment.summary,
        },
      };
    });
  }, [flowNodes, enrichmentMap]);

  const onNodesChange = (changes: NodeChange[]) => {
    setFlowNodes((nds) => {
      const updatedNodes = applyNodeChanges(changes, nds);
      
      // Save positions for nodes that were moved
      const positionChanges = changes.filter(c => c.type === 'position' && c.dragging === false);
      if (positionChanges.length > 0 && workspacePath) {
        try {
          const currentSaved = JSON.parse(localStorage.getItem(`layout-${workspacePath}`) || '{}');
          let modified = false;
          
          updatedNodes.forEach(node => {
            if (positionChanges.some(pc => (pc as any).id === node.id)) {
              currentSaved[node.id] = node.position;
              modified = true;
            }
          });
          
          if (modified) {
            localStorage.setItem(`layout-${workspacePath}`, JSON.stringify(currentSaved));
            // Note: We don't update the savedPositions useMemo state here 
            // because we don't want to trigger a full recalculation/relayout of everything
            // just from a drag. The updatedNodes state already has the new position.
          }
        } catch (e) {
          console.error("Failed to save positions", e);
        }
      }
      
      return updatedNodes;
    });
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setFlowEdges((eds) => applyEdgeChanges(changes, eds));
  };

  return { flowNodes, flowEdges, enrichedFlowNodes, onNodesChange, onEdgesChange };
}
