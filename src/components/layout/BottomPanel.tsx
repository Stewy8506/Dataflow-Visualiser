import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronUp, Minus, X, Terminal as TerminalIcon, Search, Grid3x3, ExternalLink, ArrowUpRight, ArrowDownLeft, FileEdit, Link2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Terminal } from './Terminal';

interface BottomPanelProps {
  selectedNode: any | null;
  logs: string[];
  preferredIde: string;
  workspacePath: string | null;
  edges: any[];
  onRefactorClick?: (path: string) => void;
  onPropTrace?: (trace: any) => void;
}

export function BottomPanel({ selectedNode, logs, preferredIde, workspacePath, edges, onRefactorClick, onPropTrace }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<'inspector' | 'console' | 'terminal' | 'matrix'>('inspector');
  const [shell, setShell] = useState('powershell.exe');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [propToTrace, setPropToTrace] = useState('');
  const [isTracingProp, setIsTracingProp] = useState(false);
  const [panelHeight, setPanelHeight] = useState(240);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'console' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(500, Math.max(150, startHeight.current + delta));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelHeight]);

  const tabs = [
    { id: 'inspector' as const, label: 'Inspector', icon: Search, badge: selectedNode?.data?.label },
    { id: 'console' as const, label: 'Output Logs', icon: TerminalIcon, badge: logs.length > 0 ? logs.length : undefined },
    { id: 'terminal' as const, label: 'Terminal', icon: TerminalIcon },
    { id: 'matrix' as const, label: 'Matrix', icon: Grid3x3 },
  ];

  if (isCollapsed) {
    return (
      <div
        className="h-8 border-t border-border bg-surface flex items-center justify-center px-4 z-10 flex-shrink-0 cursor-pointer hover:bg-surface-raised transition-colors group"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex items-center gap-2 text-text-dim group-hover:text-text-muted transition-colors">
          <ChevronUp size={14} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Show Panel</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-t border-border bg-surface flex flex-col z-10 flex-shrink-0"
      style={{ height: panelHeight }}
    >
      {/* Drag handle */}
      <div
        className="h-1.5 w-full cursor-row-resize flex items-center justify-center group hover:bg-blue-500/5 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="w-8 h-0.5 rounded-full bg-text-dim/40 group-hover:bg-blue-400/40 transition-colors" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 border-b border-border-subtle">
        <div className="flex items-center gap-1 py-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${activeTab === tab.id
                    ? 'bg-surface-raised text-text-main border border-border'
                    : 'text-text-dim hover:text-text-muted border border-transparent'
                  }`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none ${activeTab === tab.id ? 'bg-blue-500/20 text-blue-400' : 'bg-surface border border-border text-text-muted'
                    }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'terminal' && (
            <select
              value={shell}
              onChange={(e) => setShell(e.target.value)}
              className="bg-surface-raised border border-border text-xs text-text-main rounded px-2 py-1 outline-none mr-2 focus:border-primary transition-colors"
            >
              <option value="powershell.exe">PowerShell</option>
              <option value="cmd.exe">Command Prompt</option>
              <option value="bash">Bash (Mac/Linux/WSL)</option>
              <option value="zsh">Zsh (Mac/Linux)</option>
            </select>
          )}
          <button
            className="p-1.5 text-text-dim hover:text-text-muted rounded-md hover:bg-surface-raised transition-colors cursor-pointer"
            onClick={() => setIsCollapsed(true)}
            title="Minimize"
          >
            <Minus size={12} />
          </button>
          <button
            className="p-1.5 text-text-dim hover:text-text-muted rounded-md hover:bg-surface-raised transition-colors cursor-pointer"
            onClick={() => setIsCollapsed(true)}
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'inspector' && (
          <>
            <div className="w-72 border-r border-border-subtle p-4 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
                  {selectedNode ? `Selected: ${selectedNode.data?.label}` : 'No Selection'}
                </h3>
                <div className="flex items-center gap-1">
                  {selectedNode && selectedNode.data?.path && onRefactorClick && (
                    <button
                      onClick={() => onRefactorClick(selectedNode.data.path)}
                      className="p-1 rounded-md text-text-dim hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      title="Preview Refactor Impact"
                    >
                      <FileEdit size={14} />
                    </button>
                  )}
                  {selectedNode && selectedNode.data?.path && (
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

                  {/* Prop Tracing */}
                  {(selectedNode.data?.group === 'tsx' || selectedNode.data?.group === 'jsx') && workspacePath && onPropTrace && (
                    <div className="pt-2 mt-1 border-t border-border-subtle">
                      <span className="text-[10px] text-text-dim uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <Link2 size={10} /> Trace Prop Flow
                      </span>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={propToTrace}
                          onChange={(e) => setPropToTrace(e.target.value)}
                          placeholder="e.g. userId"
                          className="flex-1 bg-background border border-border rounded px-2 py-1 text-[11px] text-text-main outline-none focus:border-blue-500/50"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && propToTrace) {
                              setIsTracingProp(true);
                              try {
                                const result = await invoke('trace_prop', {
                                  workspacePath,
                                  filePath: selectedNode.data.path,
                                  propName: propToTrace
                                });
                                onPropTrace(result);
                              } catch (err) {
                                console.error('Prop trace failed', err);
                              } finally {
                                setIsTracingProp(false);
                              }
                            }
                          }}
                        />
                        <button
                          disabled={!propToTrace || isTracingProp}
                          onClick={async () => {
                            if (!propToTrace) return;
                            setIsTracingProp(true);
                            try {
                              const result = await invoke('trace_prop', {
                                workspacePath,
                                filePath: selectedNode.data.path,
                                propName: propToTrace
                              });
                              onPropTrace(result);
                            } catch (err) {
                              console.error('Prop trace failed', err);
                            } finally {
                              setIsTracingProp(false);
                            }
                          }}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-[10px] font-medium transition-colors disabled:opacity-50"
                        >
                          {isTracingProp ? '...' : 'Trace'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dependencies & Dependents */}
                  {edges.length > 0 && selectedNode && (() => {
                    const nodeId = selectedNode.id;
                    // originalSource is the importer, originalTarget is the imported
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
                              {circularDeps.map((dep, i) => {
                                const name = dep.split('/').pop() || dep;
                                return (
                                  <div key={i} className="text-[10px] text-rose-300/80 font-mono truncate py-0.5">
                                    {name}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {selectedNode.data?.unused_exports && selectedNode.data.unused_exports.length > 0 && (
                          <div className="pt-2 mt-1 border-t border-border-subtle">
                            <span className="text-[10px] text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1.5 font-bold">
                              ⚠ Unused Exports ({selectedNode.data.unused_exports.length})
                            </span>
                            <div className="space-y-0.5">
                              {selectedNode.data.unused_exports.map((exp: string, i: number) => (
                                <div key={i} className="text-[10px] text-amber-300/80 font-mono truncate py-0.5">
                                  {exp}
                                </div>
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
                              {dependencies.map((dep, i) => {
                                const name = dep.split('/').pop() || dep;
                                return (
                                  <div key={i} className="text-[10px] text-text-muted font-mono truncate py-0.5">
                                    {name}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {dependents.length > 0 && (
                          <div className="pt-2 mt-1 border-t border-border-subtle">
                            <span className="text-[10px] text-text-dim uppercase tracking-wider flex items-center gap-1 mb-1.5">
                              <ArrowDownLeft size={10} /> Dependents ({dependents.length})
                            </span>
                            <div className="space-y-0.5">
                              {dependents.map((dep, i) => {
                                const name = dep.split('/').pop() || dep;
                                return (
                                  <div key={i} className="text-[10px] text-text-muted font-mono truncate py-0.5">
                                    {name}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-xs text-text-dim italic">
                  Click a node in the graph to inspect.
                </div>
              )}
            </div>

            <div className="flex-1 p-4 bg-background font-mono text-[11px] overflow-y-auto border-l border-border">
              {logs.length > 0 ? (
                <div className="space-y-0.5">
                  {logs.map((log, i) => {
                    const isError = log.toLowerCase().includes('error');
                    const isSuccess = log.includes('successfully') || log.includes('completed');
                    return (
                      <div key={i} className={`flex items-start gap-2 py-0.5 ${isError ? 'text-red-400' : isSuccess ? 'text-emerald-400' : 'text-text-dim'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${isError ? 'bg-red-400' : isSuccess ? 'bg-emerald-400' : 'bg-text-dim/40'
                          }`} />
                        <span>{log}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-text-dim">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Ready. Select a project folder to begin analysis.</span>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'console' && (
          <div className="flex-1 p-4 bg-background font-mono text-[11px] overflow-y-auto">
            {logs.length > 0 ? (
              <div className="space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    <span className="text-text-dim shrink-0 select-none">❯</span>
                    <span className="text-text-muted">{log}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="text-text-dim">No log entries yet.</div>
            )}
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="flex-1 w-full h-full overflow-hidden bg-[#0a0a0a]">
            <Terminal key={shell} shell={shell} workspacePath={workspacePath} />
          </div>
        )}

        {activeTab === 'matrix' && (
          <div className="flex-1 overflow-auto p-4 bg-background">
            {edges.length > 0 ? (() => {
              const nodes = Array.from(new Set(edges.flatMap(e => [e.data?.originalSource || e.source, e.data?.originalTarget || e.target]).filter(Boolean))).slice(0, 30);

              if (nodes.length === 0) return <div className="text-text-dim text-xs">No dependencies found.</div>;

              return (
                <div className="inline-block">
                  <div className="flex mb-1">
                    <div className="w-32 shrink-0"></div>
                    {nodes.map(n => {
                      const name = n.split('/').pop() || n;
                      return (
                        <div key={n} className="w-5 text-[8px] text-text-dim rotate-45 origin-bottom-left whitespace-nowrap truncate" title={n}>
                          {name}
                        </div>
                      );
                    })}
                  </div>
                  {nodes.map(rowNode => {
                    const rowName = rowNode.split('/').pop() || rowNode;
                    return (
                      <div key={rowNode} className="flex items-center gap-1 mb-1">
                        <div className="w-32 text-[10px] text-text-dim truncate text-right pr-2" title={rowNode}>
                          {rowName}
                        </div>
                        {nodes.map(colNode => {
                          const hasEdge = edges.some(e =>
                            (e.data?.originalSource === rowNode && e.data?.originalTarget === colNode) ||
                            (e.source === rowNode && e.target === colNode)
                          );
                          return (
                            <div
                              key={`${rowNode}-${colNode}`}
                              className={`w-4 h-4 rounded-sm ${hasEdge ? 'bg-blue-500' : 'bg-surface-raised'} hover:bg-blue-400 transition-colors cursor-pointer`}
                              title={`${rowName} → ${colNode.split('/').pop() || colNode}`}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="mt-4 text-[10px] text-text-dim">
                    Showing top {nodes.length} nodes (Rows: Importer, Columns: Imported)
                  </div>
                </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Grid3x3 size={32} className="text-text-dim/30" />
                <p className="text-sm text-text-dim font-medium">No Data</p>
                <p className="text-xs text-text-dim/60">Load a project to see the dependency matrix.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
