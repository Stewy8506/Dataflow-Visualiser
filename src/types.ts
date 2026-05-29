// ─── Core Graph Types ─────────────────────────────────────────────────────────

export interface NodeMetrics {
  function_count: number;
  import_count: number;
  complexity_score: 'Low' | 'Medium' | 'High';
}

export interface ParsedNode {
  id: string;
  label: string;
  group: string;
  semantic_group?: string;
  summary?: string;
  unused_exports?: string[];
  metrics?: NodeMetrics;
}

export interface ParsedEdge {
  source: string;
  target: string;
  via: string | null;
  is_data_source?: boolean;
}

export interface GraphData {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
}

// ─── Application Settings ─────────────────────────────────────────────────────

export interface AppSettings {
  apiKey: string;
  selectedModel: string;
  enableAi: boolean;
  preferredIde: string;
  isLightMode: boolean;
}

// ─── UI / Layout Types ────────────────────────────────────────────────────────

export type GraphLayer = 'ui' | 'backend' | 'overall';

export type ViewMode = '2d' | '3d';

export type ActiveTab = 'network' | 'source-control' | 'explorer';

export type LayoutDirection = 'LR' | 'TB';

export type SearchMode = 'highlight' | 'collapse';

// ─── Enrichment ───────────────────────────────────────────────────────────────

export interface EnrichmentEntry {
  semantic_group: string;
  summary: string;
}

// ─── Flow Node Data ───────────────────────────────────────────────────────────

export interface FlowNodeData {
  label: string;
  path: string;
  subLabel: string;
  group: string;
  type: string;
  isBackend: boolean;
  isExternal: boolean;
  isDeadCode: boolean;
  isEntryPoint?: boolean;
  semantic_group?: string;
  summary?: string;
  metrics?: NodeMetrics;
  unused_exports?: string[];
  layerIndex: number;
  direction: LayoutDirection;
  onDelete?: () => void;
}

// ─── Snapshot / Diff ─────────────────────────────────────────────────────────

export interface SnapshotDiff {
  added_edges: [string, string][];
  removed_edges: [string, string][];
  added_nodes: string[];
  removed_nodes: string[];
}

// ─── Prop Trace ───────────────────────────────────────────────────────────────

export interface PropTraceResult {
  prop_name: string;
  involved_files: string[];
}
