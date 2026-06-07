import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExternalLink, FileEdit, ArrowUpRight, ArrowDownLeft, Sparkles, Search, Link2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface InspectorPanelProps {
  selectedNode: any | null;
  preferredIde: string;
  workspacePath: string | null;
  edges: any[];
  onRefactorClick?: (path: string) => void;
  onPropTrace?: (trace: any) => void;
}

export function InspectorPanel({ selectedNode, preferredIde, workspacePath, edges, onRefactorClick, onPropTrace }: InspectorPanelProps) {
  const { setShowAiChat } = useAppStore();

  if (!selectedNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background/10 h-full min-h-[160px] w-full">
        <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center text-text-dim mb-3 shadow-sm animate-pulse">
          <Search size={18} />
        </div>
        <p className="text-sm font-medium text-text-main">No Node Selected</p>
        <p className="text-xs text-text-dim mt-1 max-w-sm leading-relaxed">
          Select a file node in the graph workspace to inspect its dependencies, imports, and AI insights.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-5 flex flex-col overflow-y-auto bg-background/20 select-text">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-primary animate-pulse" />
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-text-main tracking-tight font-sans">
              {selectedNode.data?.label}
            </h3>
            <span className="text-[10px] text-text-dim font-mono truncate max-w-[280px] sm:max-w-md md:max-w-xl">
              {selectedNode.data?.path}
            </span>
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-1.5 bg-surface rounded-lg p-1 border border-border">
          {selectedNode.data?.path && onRefactorClick && (
            <button
              onClick={() => onRefactorClick(selectedNode.data.path)}
              className="p-1.5 rounded-md text-text-dim hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
              title="Preview Refactor Impact"
            >
              <FileEdit size={14} />
            </button>
          )}
          {selectedNode.data?.path && (
            <button
              onClick={() => setShowAiChat(true)}
              className="p-1.5 rounded-md text-text-dim hover:text-fuchsia-400 hover:bg-fuchsia-500/10 transition-colors cursor-pointer"
              title="Ask AI about this file"
            >
              <Sparkles size={14} />
            </button>
          )}
          {selectedNode.data?.path && (
            <button
              onClick={() => invoke('open_in_ide', { path: selectedNode.data.path, ide: preferredIde })}
              className="p-1.5 rounded-md text-text-dim hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
              title={`Open in ${preferredIde}`}
            >
              <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Spacious Multi-Column Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Column 1: File Specs & Actions */}
        <div className="space-y-4 flex flex-col bg-surface/40 p-4 rounded-xl border border-border-subtle h-full overflow-y-auto">
          <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider block">
            File Specifications
          </span>
          <div className="space-y-2 font-sans">
            {[
              { label: 'Type', value: selectedNode.data?.subLabel || '—' },
              { label: 'Extension', value: selectedNode.data?.group?.toUpperCase() || '—' },
              ...(selectedNode.data?.semantic_group ? [{ label: 'Semantic Group', value: selectedNode.data.semantic_group }] : []),
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-border-subtle/40 last:border-b-0">
                <span className="text-[11px] text-text-dim">{row.label}</span>
                <span className="text-[11px] font-semibold text-text-muted">{row.value}</span>
              </div>
            ))}
          </div>

          <PropTracerInline
            selectedNode={selectedNode}
            workspacePath={workspacePath}
            onPropTrace={onPropTrace}
          />
        </div>

        {/* Column 2: AI Code Summary */}
        <div className="space-y-3 bg-surface/40 p-4 rounded-xl border border-border-subtle flex flex-col h-full overflow-hidden">
          <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider block shrink-0">
            AI Summary Analysis
          </span>
          <div className="flex-1 overflow-y-auto text-xs text-text-muted leading-relaxed font-sans pr-1">
            {selectedNode.data?.summary ? (
              <p className="whitespace-pre-line">{selectedNode.data.summary}</p>
            ) : (
              <p className="italic text-text-dim/60">No AI-generated summary available for this file.</p>
            )}
          </div>
        </div>

        {/* Column 3: Dependencies & Alerts */}
        <div className="space-y-3 bg-surface/40 p-4 rounded-xl border border-border-subtle flex flex-col h-full overflow-hidden">
          <DependencyAndAlertsSummary selectedNode={selectedNode} edges={edges} isDependentsColumn={false} />
        </div>

        {/* Column 4: Dependents */}
        <div className="space-y-3 bg-surface/40 p-4 rounded-xl border border-border-subtle flex flex-col h-full overflow-hidden">
          <DependencyAndAlertsSummary selectedNode={selectedNode} edges={edges} isDependentsColumn={true} />
        </div>

      </div>
    </div>
  );
}

// ─── Prop Tracer Inline ───────────────────────────────────────────────────────

function PropTracerInline({ selectedNode, workspacePath, onPropTrace }: {
  selectedNode: any;
  workspacePath: string | null;
  onPropTrace?: (trace: any) => void;
}) {
  const [propToTrace, setPropToTrace] = useState('');
  const [isTracingProp, setIsTracingProp] = useState(false);

  if (!selectedNode || !['tsx', 'jsx'].includes(selectedNode.data?.group) || !workspacePath || !onPropTrace) {
    return null;
  }

  const runTrace = async () => {
    if (!propToTrace) return;
    setIsTracingProp(true);
    try {
      const result = await invoke('trace_prop', {
        workspacePath,
        filePath: selectedNode.data.path,
        propName: propToTrace,
      });
      onPropTrace(result);
    } catch (err) {
      console.error('Prop trace failed', err);
    } finally {
      setIsTracingProp(false);
    }
  };

  return (
    <div className="pt-3 border-t border-border-subtle/60">
      <span className="text-[10px] text-text-dim uppercase tracking-wider flex items-center gap-1.5 mb-2 font-medium">
        <Link2 size={11} /> Trace Prop Flow
      </span>
      <div className="flex gap-2">
        <input
          type="text"
          value={propToTrace}
          onChange={e => setPropToTrace(e.target.value)}
          placeholder="e.g. userId"
          className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-[11px] text-text-main outline-none focus:border-blue-500/50 placeholder:text-text-dim/40"
          onKeyDown={e => { if (e.key === 'Enter') runTrace(); }}
        />
        <button
          disabled={!propToTrace || isTracingProp}
          onClick={runTrace}
          className="px-2.5 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[10px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isTracingProp ? '...' : 'Trace'}
        </button>
      </div>
    </div>
  );
}

// ─── Dependency & Alerts Summary ──────────────────────────────────────────────

interface DependencyAndAlertsProps {
  selectedNode: any;
  edges: any[];
  isDependentsColumn: boolean;
}

function DependencyAndAlertsSummary({ selectedNode, edges, isDependentsColumn }: DependencyAndAlertsProps) {
  if (!edges.length || !selectedNode) return null;

  const nodeId = selectedNode.id;
  const dependencies = edges
    .filter(e => e.data?.originalSource === nodeId)
    .map(e => e.data?.originalTarget)
    .filter(Boolean) as string[];
  const dependents = edges
    .filter(e => e.data?.originalTarget === nodeId)
    .map(e => e.data?.originalSource)
    .filter(Boolean) as string[];
  const circularDeps = edges
    .filter(e => (e.data?.originalSource === nodeId || e.data?.originalTarget === nodeId) && e.style?.strokeDasharray === '8 4')
    .map(e => e.data?.originalSource === nodeId ? e.data?.originalTarget : e.data?.originalSource)
    .filter(Boolean) as string[];

  if (isDependentsColumn) {
    return (
      <>
        <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <ArrowDownLeft size={11} className="text-blue-400" /> Output Dependents ({dependents.length})
        </span>
        <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[10.5px] pr-1">
          {dependents.length > 0 ? (
            dependents.map((dep, i) => (
              <div 
                key={i} 
                className="py-1 px-2 rounded bg-surface border border-border/40 text-text-muted truncate hover:text-text-main transition-colors"
                title={dep}
              >
                {dep.split('/').pop() || dep}
              </div>
            ))
          ) : (
            <span className="text-text-dim/60 italic block py-2">No other files import this module.</span>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Alerts section */}
      {circularDeps.length > 0 && (
        <div className="pb-3 border-b border-border-subtle/40 shrink-0">
          <span className="text-[10px] text-rose-400 uppercase tracking-wider flex items-center gap-1 mb-1.5 font-bold animate-pulse">
            ⚠ Circular Loops ({circularDeps.length})
          </span>
          <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
            {circularDeps.map((dep, i) => (
              <div key={i} className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded font-mono truncate" title={dep}>
                {dep.split('/').pop() || dep}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedNode.data?.unused_exports?.length > 0 && (
        <div className="pb-3 border-b border-border-subtle/40 shrink-0">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1.5 font-bold">
            ⚠ Unused Exports ({selectedNode.data.unused_exports.length})
          </span>
          <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
            {selectedNode.data.unused_exports.map((exp: string, i: number) => (
              <div key={i} className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded font-mono truncate">{exp}</div>
            ))}
          </div>
        </div>
      )}

      <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-1.5 shrink-0 pt-1">
        <ArrowUpRight size={11} className="text-teal-400" /> Input Dependencies ({dependencies.length})
      </span>
      <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[10.5px] pr-1">
        {dependencies.length > 0 ? (
          dependencies.map((dep, i) => (
            <div 
              key={i} 
              className="py-1 px-2 rounded bg-surface border border-border/40 text-text-muted truncate hover:text-text-main transition-colors"
              title={dep}
            >
              {dep.split('/').pop() || dep}
            </div>
          ))
        ) : (
          <span className="text-text-dim/60 italic block py-2">No imported dependencies found.</span>
        )}
      </div>
    </>
  );
}
