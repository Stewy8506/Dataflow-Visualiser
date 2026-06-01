import { invoke } from '@tauri-apps/api/core';
import { ExternalLink, FileEdit, ArrowUpRight, ArrowDownLeft, Sparkles } from 'lucide-react';
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
  return (
    <>
      {/* Left: Node metadata */}
      <div className="w-72 border-r border-border-subtle p-4 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
            {selectedNode ? `Selected: ${selectedNode.data?.label}` : 'No Selection'}
          </h3>
          <div className="flex items-center gap-1">
            {selectedNode?.data?.path && onRefactorClick && (
              <button
                onClick={() => onRefactorClick(selectedNode.data.path)}
                className="p-1 rounded-md text-text-dim hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                title="Preview Refactor Impact"
              >
                <FileEdit size={14} />
              </button>
            )}
            {selectedNode?.data?.path && (
              <button
                onClick={() => setShowAiChat(true)}
                className="p-1 rounded-md text-text-dim hover:text-fuchsia-400 hover:bg-fuchsia-500/10 transition-colors cursor-pointer"
                title="Ask AI about this file"
              >
                <Sparkles size={14} />
              </button>
            )}
            {selectedNode?.data?.path && (
              <button
                onClick={() => invoke('open_in_ide', { path: selectedNode.data.path, ide: preferredIde })}
                className="p-1 rounded-md text-text-dim hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                title={`Open in ${preferredIde}`}
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        </div>

        {selectedNode ? (
          <div className="space-y-0.5">
            {[
              { label: 'Type', value: selectedNode.data?.subLabel || '—' },
              { label: 'Extension', value: selectedNode.data?.group?.toUpperCase() || '—' },
              { label: 'Path', value: selectedNode.data?.path || '—', mono: true },
              ...(selectedNode.data?.semantic_group ? [{ label: 'AI Group', value: selectedNode.data.semantic_group }] : []),
            ].map((row, i) => (
              <div key={i} className={`flex justify-between items-center py-2 ${i > 0 ? 'border-t border-border-subtle' : ''}`}>
                <span className="text-[11px] text-text-dim">{row.label}</span>
                <span className={`text-[11px] font-medium text-text-main ${row.mono ? 'font-mono text-[10px] max-w-[140px] truncate' : ''}`}>
                  {row.value}
                </span>
              </div>
            ))}

            {selectedNode.data?.summary && (
              <div className="pt-2 mt-1 border-t border-border-subtle">
                <span className="text-[10px] text-text-dim uppercase tracking-wider block mb-1.5">AI Summary</span>
                <p className="text-[11px] text-text-muted leading-relaxed">{selectedNode.data.summary}</p>
              </div>
            )}

            <PropTracerInline
              selectedNode={selectedNode}
              workspacePath={workspacePath}
              onPropTrace={onPropTrace}
            />

            <DependencySummary selectedNode={selectedNode} edges={edges} />
          </div>
        ) : (
          <div className="text-xs text-text-dim italic">Click a node in the graph to inspect.</div>
        )}
      </div>

      {/* Right: inline output log strip */}
      <InlineLogStrip />
    </>
  );
}

// ─── Prop Tracer Inline ───────────────────────────────────────────────────────

import { useState } from 'react';
import { Link2 } from 'lucide-react';

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
    <div className="pt-2 mt-1 border-t border-border-subtle">
      <span className="text-[10px] text-text-dim uppercase tracking-wider flex items-center gap-1 mb-1.5">
        <Link2 size={10} /> Trace Prop Flow
      </span>
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          value={propToTrace}
          onChange={e => setPropToTrace(e.target.value)}
          placeholder="e.g. userId"
          className="flex-1 bg-background border border-border rounded px-2 py-1 text-[11px] text-text-main outline-none focus:border-blue-500/50"
          onKeyDown={e => { if (e.key === 'Enter') runTrace(); }}
        />
        <button
          disabled={!propToTrace || isTracingProp}
          onClick={runTrace}
          className="px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[10px] font-medium transition-colors disabled:opacity-50"
        >
          {isTracingProp ? '...' : 'Trace'}
        </button>
      </div>
    </div>
  );
}

// ─── Dependency Summary ───────────────────────────────────────────────────────

function DependencySummary({ selectedNode, edges }: { selectedNode: any; edges: any[] }) {
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

  return (
    <>
      {circularDeps.length > 0 && (
        <div className="pt-2 mt-1 border-t border-border-subtle">
          <span className="text-[10px] text-rose-400 uppercase tracking-wider flex items-center gap-1 mb-1.5 font-bold">
            ⚠ Circular Dependencies ({circularDeps.length})
          </span>
          <div className="space-y-0.5">
            {circularDeps.map((dep, i) => (
              <div key={i} className="text-[10px] text-rose-300/80 font-mono truncate py-0.5">
                {dep.split('/').pop() || dep}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedNode.data?.unused_exports?.length > 0 && (
        <div className="pt-2 mt-1 border-t border-border-subtle">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1.5 font-bold">
            ⚠ Unused Exports ({selectedNode.data.unused_exports.length})
          </span>
          <div className="space-y-0.5">
            {selectedNode.data.unused_exports.map((exp: string, i: number) => (
              <div key={i} className="text-[10px] text-amber-300/80 font-mono truncate py-0.5">{exp}</div>
            ))}
          </div>
        </div>
      )}

      {dependencies.length > 0 && (
        <div className="pt-2 mt-1 border-t border-border-subtle">
          <span className="text-[10px] text-text-dim uppercase tracking-wider flex items-center gap-1 mb-1.5">
            <ArrowUpRight size={10} /> Dependencies ({dependencies.length})
          </span>
          <div className="space-y-0.5">
            {dependencies.map((dep, i) => (
              <div key={i} className="text-[10px] text-text-muted font-mono truncate py-0.5">{dep.split('/').pop() || dep}</div>
            ))}
          </div>
        </div>
      )}

      {dependents.length > 0 && (
        <div className="pt-2 mt-1 border-t border-border-subtle">
          <span className="text-[10px] text-text-dim uppercase tracking-wider flex items-center gap-1 mb-1.5">
            <ArrowDownLeft size={10} /> Dependents ({dependents.length})
          </span>
          <div className="space-y-0.5">
            {dependents.map((dep, i) => (
              <div key={i} className="text-[10px] text-text-muted font-mono truncate py-0.5">{dep.split('/').pop() || dep}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Inline Log Strip ─────────────────────────────────────────────────────────

function InlineLogStrip() {
  // Intentionally left as a placeholder — logs are rendered in the console tab
  return (
    <div className="flex-1 p-4 bg-background font-mono text-[11px] overflow-y-auto border-l border-border">
      <div className="flex items-center gap-2 text-text-dim">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>Select a node to inspect its details.</span>
      </div>
    </div>
  );
}
