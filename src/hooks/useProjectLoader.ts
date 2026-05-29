import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';
import type { GraphData, EnrichmentEntry } from '../types';

interface UseProjectLoaderOptions {
  apiKey: string;
  enableAi: boolean;
  selectedModel: string;
}

export function useProjectLoader({ apiKey, enableAi, selectedModel }: UseProjectLoaderOptions) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [rawGraphData, setRawGraphData] = useState<GraphData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [enrichmentMap, setEnrichmentMap] = useState<Map<string, EnrichmentEntry>>(new Map());

  // Load recent projects from Tauri store on mount
  useEffect(() => {
    load('settings.json', { autoSave: false, defaults: { preferredIde: 'code', recentProjects: [] } }).then(store => {
      store.get<string[]>('recentProjects').then(val => {
        if (val && Array.isArray(val)) setRecentProjects(val);
      });
    });
  }, []);

  // Tauri event listeners
  useEffect(() => {
    const unlisten = listen('ai_nodes_enriched', (event) => {
      const enrichedNodes = event.payload as { id: string; semantic_group: string; summary: string }[];
      setEnrichmentMap(prev => {
        const next = new Map(prev);
        enrichedNodes.forEach(en => next.set(en.id, {
          semantic_group: en.semantic_group,
          summary: en.summary,
        }));
        return next;
      });
      setLogs(prev => [...prev, `> AI enriched ${enrichedNodes.length} nodes.`]);
    });

    const unlistenComplete = listen('ai_enrichment_complete', () => {
      setIsEnriching(false);
      setLogs(prev => [...prev, '> Progressive AI Enrichment fully completed.']);
    });

    const unlistenUpdate = listen('node_updated', (event) => {
      const payload = event.payload as { node: any; resolved_imports: [string, boolean][] };
      setRawGraphData(prev => {
        if (!prev) return prev;
        const newNodes = prev.nodes.filter(n => n.id !== payload.node.id);
        newNodes.push(payload.node);

        const newEdges = prev.edges.filter(e => e.source !== payload.node.id);
        const exts = ['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'dart'];
        for (const [targetStr, isDataSource] of payload.resolved_imports) {
          const targetLower = targetStr.toLowerCase();
          const match = prev.nodes.find(n => {
            const idLower = n.id.toLowerCase();
            return exts.some(ext =>
              idLower.endsWith(`/${targetLower}.${ext}`) ||
              idLower.endsWith(`/${targetLower}/index.${ext}`) ||
              idLower.endsWith(`/${targetLower}`)
            );
          });
          if (match) {
            newEdges.push({ source: payload.node.id, target: match.id, via: null, is_data_source: isDataSource });
          }
        }
        return { nodes: newNodes, edges: newEdges };
      });
      setLogs(prev => [...prev, `> Live update: Re-parsed ${payload.node.label}`]);
    });

    return () => {
      unlisten.then(f => f());
      unlistenComplete.then(f => f());
      unlistenUpdate.then(f => f());
    };
  }, []);

  const saveRecentProject = async (path: string) => {
    const updated = [path, ...recentProjects.filter(p => p !== path)].slice(0, 5);
    setRecentProjects(updated);
    const store = await load('settings.json', { autoSave: false, defaults: { preferredIde: 'code', recentProjects: [] } });
    await store.set('recentProjects', updated);
    await store.save();
  };

  const loadProject = useCallback(async (path: string, logPrefix: string) => {
    setIsParsing(true);
    setSelectedPath(null);
    setLogs([`> ${logPrefix}: ${path}`, '> Parsing codebase...']);

    await new Promise(resolve => setTimeout(resolve, 400));

    try {
      const result: GraphData = await invoke('parse_codebase', { path });
      invoke('watch_codebase', { path }).catch(e => console.error('Watcher init error', e));

      setEnrichmentMap(new Map());
      setRawGraphData(result);
      setSelectedPath(path);
      setLogs(prev => [...prev, `> Parsed ${result.nodes.length} files successfully.`]);
      setIsParsing(false);

      await saveRecentProject(path);

      if (apiKey && enableAi) {
        setLogs(prev => [...prev, `> Found API Key, starting progressive AI enrichment with ${selectedModel}...`]);
        setIsEnriching(true);
        try {
          await invoke('enrich_graph_with_ai', { graphData: result, apiKey, model: selectedModel });
        } catch (aiErr) {
          console.error('AI Enrichment Error:', aiErr);
          setLogs(prev => [...prev, `> AI Error: ${String(aiErr)}`]);
          setIsEnriching(false);
        }
      } else if (apiKey && !enableAi) {
        setLogs(prev => [...prev, '> AI summary generation is disabled in Settings.']);
      }
    } catch (e) {
      console.error(e);
      setLogs(prev => [...prev, `> Error: ${String(e)}`]);
      setIsParsing(false);
      import('@tauri-apps/plugin-dialog').then(({ message }) => {
        message(`Failed to load project: ${String(e)}`, { title: 'Project Load Error', kind: 'error' });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, enableAi, selectedModel, recentProjects]);

  const handleSelectDirectory = useCallback(async () => {
    try {
      const path = await open({ directory: true, multiple: false });
      if (path) await loadProject(path, 'Selected directory');
    } catch (e) {
      console.error(e);
      setLogs(prev => [...prev, `> Error: ${String(e)}`]);
    }
  }, [loadProject]);

  const handleOpenRecentProject = useCallback(async (path: string) => {
    await loadProject(path, 'Opening recent project');
  }, [loadProject]);

  const handleDeleteNode = useCallback((nodeId: string, nodePath: string) => {
    setRawGraphData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== nodeId),
        edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      };
    });
    setLogs(prev => [...prev, `> Permanently deleted: ${nodePath}`]);
  }, []);

  return {
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
  };
}
