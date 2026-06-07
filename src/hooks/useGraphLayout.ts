import { useState, useEffect, useMemo, useRef } from 'react';
import { Edge, MarkerType, applyNodeChanges, NodeChange, applyEdgeChanges, EdgeChange } from '@xyflow/react';
import LayoutWorker from '../workers/layout.worker?worker';
import type { GraphData, EnrichmentEntry } from '../types';
import { calculateHealthScore } from '../utils/healthScore';
import { useAppStore } from '../store/appStore';
import { load } from '@tauri-apps/plugin-store';

interface UseGraphLayoutOptions {
  rawGraphData: GraphData | null;
  enrichmentMap: Map<string, EnrichmentEntry>;
  onDeleteNode: (nodeId: string, nodePath: string) => void;
  workspacePath: string | null;
}

const DEFAULT_TOOLING_REGEX = /^(eslint|typescript|tailwindcss|postcss|autoprefixer|vite|prettier|jest|vitest|playwright|cypress|nodemon|ts-node|husky|lint-staged|react|react-dom|next|vue|svelte|@types\/.*|@eslint\/.*|@typescript-eslint\/.*|eslint-.*|@tailwindcss\/.*)$/;

export function useGraphLayout({
  rawGraphData,
  enrichmentMap,
  onDeleteNode,
  workspacePath,
}: UseGraphLayoutOptions) {
  const {
    activeLayer,
    layoutDirection,
    nodesep,
    ranksep,
    searchQuery,
    searchMode,
    showExternalDeps,
    showTests,
    showSemanticEdges,
    customFilters,
    showUiOnly
  } = useAppStore();

  const [flowNodes, setFlowNodes] = useState<any[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    let cancelled = false;
    if (!workspacePath) {
      setSavedPositions({});
      return;
    }

    load('layout.json', { autoSave: true, defaults: {} }).then(async store => {
      const data = await store.get<Record<string, { x: number; y: number }>>(`layout-${workspacePath}`);
      if (!cancelled) setSavedPositions(data || {});
    }).catch(e => {
      console.error("Failed to load saved positions", e);
      if (!cancelled) setSavedPositions({});
    });

    return () => { cancelled = true; };
  }, [workspacePath]);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new LayoutWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!rawGraphData) return;

    const timeoutId = setTimeout(() => {
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

        const normalizedPath = n.id.replace(/\\/g, '/').toLowerCase();

        if (!showTests) {
          if (
            normalizedPath.includes('.test.') || 
            normalizedPath.includes('.spec.') || 
            normalizedPath.includes('/tests/') || 
            normalizedPath.includes('/__tests__/') ||
            normalizedPath.includes('/mocks/') ||
            normalizedPath.includes('__mocks__')
          ) {
            return false;
          }
        }

        if (customFilters && customFilters.trim() !== '') {
          const patterns = customFilters.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
          for (const pattern of patterns) {
            if (pattern.startsWith('*')) {
              const ext = pattern.slice(1);
              if (normalizedPath.endsWith(ext)) return false;
            } else if (normalizedPath.includes(pattern)) {
              return false;
            }
          }
        }

        const isBackend = normalizedPath.includes('/api/') || n.label.startsWith('route.') || normalizedPath.includes('/server/') || normalizedPath.includes('/backend/') || normalizedPath.includes('src-tauri');
        if (showUiOnly && !(n as any).tags?.includes('ui-component')) return false;
        
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
      const filteredRawEdges = rawGraphData.edges.filter(e => {
        if (!validNodeIds.has(e.source) || !validNodeIds.has(e.target)) return false;
        
        // Filter semantic edges if disabled
        if (!showSemanticEdges) {
          const isStructuralEdge = e.edge_type === 'import' || e.edge_type === 'api_call' || e.edge_type === 'cmake' || e.edge_type === 'nextjs' || !e.edge_type;
          if (!isStructuralEdge) return false;
        }
        return true;
      });

      const initialNodes = filteredRawNodes.map(n => {
        let subLabel = 'File';
        let isBackend = false;
        const normalizedPath = n.id.replace(/\\/g, '/').toLowerCase();

        if (normalizedPath.includes('/api/') || n.label.startsWith('route.') || normalizedPath.includes('controller') || normalizedPath.includes('handler')) {
          subLabel = 'API / Controller'; isBackend = true;
        } else if (normalizedPath.includes('/server/') || normalizedPath.includes('/backend/') || normalizedPath.includes('service')) {
          subLabel = 'Backend Service'; isBackend = true;
        } else if (normalizedPath.includes('src-tauri')) {
          subLabel = 'Rust Backend'; isBackend = true;
        } else if (['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(n.group)) {
          subLabel = 'UI Component';
        } else if (['ts', 'js', 'py', 'rs'].includes(n.group)) {
          subLabel = 'Script';
        }

        const isNonCodeFile = /\.(md|json|toml|yaml|yml|css|scss|less|gyp|txt|lock)$/i.test(n.label);
        const isEntryPoint = /^(page|layout|loading|template|error|route|main|index|App|lib|app|middleware|sitemap|test|workbench|cli|.*config.*|.*env.*)\./i.test(n.label) || n.id.includes('src-tauri');
        const isDeadCode = (inDegrees.get(n.id) || 0) === 0 && !isEntryPoint && !isNonCodeFile;

        let layerIndex = 2;
        if (n.id.startsWith('ext:')) layerIndex = 4;
        else if (isBackend) layerIndex = 3;
        else if (/^(page|main|index|app)\./i.test(n.label)) layerIndex = 0;
        else if (['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(n.group)) layerIndex = 1;

        const isUiComponent = ['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(n.group);
        const nodeType = (showUiOnly && isUiComponent) ? 'previewNode' : 'fileNode';

        return {
          id: n.id,
          type: nodeType,
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
            tags: (n as any).tags,
            vulnerabilities: (n as any).vulnerabilities,
            healthScore: calculateHealthScore(n.id, rawGraphData.edges, (n as any).metrics),
            onDelete: () => onDeleteNode(n.id, n.id),
            direction: layoutDirection,
            layerIndex,
          },
        };
      });

      const initialEdges: Edge[] = filteredRawEdges.map((e, i) => {
        let color = '#334155';
        let dashArray: string | undefined = undefined;
        let label = e.via ? (/^(GET|POST|PUT|DELETE|PATCH|USE|ALL) /.test(e.via) ? e.via : `via ${e.via}`) : undefined;

        if (e.edge_type === 'DatabaseRelation') {
           color = '#10b981';
           label = e.via || 'Relation';
        } else if (e.edge_type === 'WidgetTree') {
           color = '#0ea5e9';
           label = e.via || 'Widget';
        } else if (e.edge_type === 'Injection') {
           color = '#8b5cf6';
           label = e.via || 'Injected';
        } else if (e.edge_type === 'Workspace') {
           color = '#f59e0b';
           label = e.via || 'Workspace';
        } else if (e.edge_type === 'AsyncExecution') {
           color = '#ec4899';
           dashArray = '5 5';
           label = e.via || 'Async';
        }

        return {
          id: `e-${i}`,
          source: e.target, // Visually: imported file feeds up into importer
          target: e.source,
          type: 'default',
          animated: e.edge_type === 'AsyncExecution',
          data: { originalSource: e.source, originalTarget: e.target },
          label,
          labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: '#111118', fillOpacity: 0.9, stroke: '#1e1e2a', strokeWidth: 1 },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 6,
          style: { stroke: color, strokeWidth: 2, strokeDasharray: dashArray },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      });

      const dagreEdges: Edge[] = filteredRawEdges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
      }));

      if (!workerRef.current) return;

      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'success') {
          const { nodes: layoutedNodes } = e.data.data;
          
          // Apply saved positions overriding dagre and re-attach functions
          const nodesWithSavedPositions = layoutedNodes.map((n: any) => {
            const savedPos = savedPositions[n.id];
            const nodeWithFuncs = {
              ...n,
              data: {
                ...n.data,
                onDelete: () => onDeleteNode(n.id, n.id)
              }
            };
            if (savedPos) {
              return { ...nodeWithFuncs, position: savedPos };
            }
            return nodeWithFuncs;
          });

          const nodeById = new Map<string, any>(nodesWithSavedPositions.map((n: any) => [n.id, n]));
          const styledEdges = initialEdges.map(edge => {
            const sourceNode = nodeById.get(edge.source);
            const targetNode = nodeById.get(edge.target);
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
            return { ...edge, sourceHandle, targetHandle };
          });

          setFlowNodes(nodesWithSavedPositions);
          setFlowEdges(styledEdges);
        } else {
          console.error("Layout worker error:", e.data.error);
        }
      };

      workerRef.current.postMessage({
        nodes: initialNodes.map(n => ({
          ...n,
          data: { ...n.data, onDelete: undefined }
        })),
        edges: dagreEdges,
        direction: layoutDirection,
        nodesep,
        ranksep
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [rawGraphData, activeLayer, layoutDirection, nodesep, ranksep, searchQuery, searchMode, enrichmentMap, showExternalDeps, showTests, showSemanticEdges, customFilters, showUiOnly, onDeleteNode, savedPositions]);

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
          const currentSaved = { ...savedPositions };
          let modified = false;
          
          updatedNodes.forEach(node => {
            if (positionChanges.some(pc => (pc as any).id === node.id)) {
              currentSaved[node.id] = node.position;
              modified = true;
            }
          });
          
          if (modified) {
            void load('layout.json', { autoSave: true, defaults: {} }).then(async store => {
              await store.set(`layout-${workspacePath}`, currentSaved);
              await store.save();
            });
            // Note: We don't update the savedPositions state here
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
