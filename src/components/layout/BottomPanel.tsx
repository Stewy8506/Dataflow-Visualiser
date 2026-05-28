import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronUp, Minus, X, Terminal, Search, Grid3x3 } from 'lucide-react';

interface BottomPanelProps {
  selectedNode: any | null;
  logs: string[];
}

export function BottomPanel({ selectedNode, logs }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<'inspector' | 'matrix' | 'console'>('inspector');
  const [isCollapsed, setIsCollapsed] = useState(false);
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
    { id: 'inspector' as const, label: 'Inspector', icon: Search },
    { id: 'console' as const, label: 'Console', icon: Terminal },
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-surface-raised text-text-main border border-border'
                    : 'text-text-dim hover:text-text-muted border border-transparent'
                }`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5">
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
              <h3 className="text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-3">
                {selectedNode ? `Selected: ${selectedNode.data?.label}` : 'No Selection'}
              </h3>
              
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
                </div>
              ) : (
                <div className="text-xs text-text-dim italic">
                  Click a node in the graph to inspect.
                </div>
              )}
            </div>
            
            <div className="flex-1 p-4 bg-[#0a0a10] font-mono text-[11px] overflow-y-auto">
              {logs.length > 0 ? (
                <div className="space-y-0.5">
                  {logs.map((log, i) => {
                    const isError = log.toLowerCase().includes('error');
                    const isSuccess = log.includes('successfully') || log.includes('completed');
                    return (
                      <div key={i} className={`flex items-start gap-2 py-0.5 ${
                        isError ? 'text-red-400' : isSuccess ? 'text-emerald-400' : 'text-text-dim'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                          isError ? 'bg-red-400' : isSuccess ? 'bg-emerald-400' : 'bg-text-dim/40'
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
          <div className="flex-1 p-4 bg-[#0a0a10] font-mono text-[11px] overflow-y-auto">
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

        {activeTab === 'matrix' && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center gap-3">
            <Grid3x3 size={32} className="text-text-dim/30" />
            <p className="text-sm text-text-dim font-medium">Dependency Matrix</p>
            <p className="text-xs text-text-dim/60">Coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
