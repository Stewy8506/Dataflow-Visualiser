import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronUp, Minus, X, Terminal as TerminalIcon, Search, Grid3x3 } from 'lucide-react';
import { Terminal } from '../../features/terminal/Terminal';
import { InspectorPanel } from '../../features/inspector/InspectorPanel';
import { MatrixPanel } from '../../features/matrix/MatrixPanel';

interface BottomPanelProps {
  selectedNode: any | null;
  logs: string[];
  preferredIde: string;
  workspacePath: string | null;
  edges: any[];
  onRefactorClick?: (path: string) => void;
  onPropTrace?: (trace: any) => void;
}

type PanelTab = 'inspector' | 'console' | 'terminal' | 'matrix';

export function BottomPanel({
  selectedNode, logs, preferredIde, workspacePath, edges, onRefactorClick, onPropTrace,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('inspector');
  const [shell, setShell] = useState('powershell.exe');
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
      setPanelHeight(Math.min(500, Math.max(150, startHeight.current + delta)));
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

  const tabs: { id: PanelTab; label: string; icon: typeof Search; badge?: string | number }[] = [
    { id: 'inspector', label: 'Inspector', icon: Search, badge: selectedNode?.data?.label },
    { id: 'console', label: 'Output Logs', icon: TerminalIcon, badge: logs.length > 0 ? logs.length : undefined },
    { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
    { id: 'matrix', label: 'Matrix', icon: Grid3x3 },
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
    <div className="border-t border-border bg-surface flex flex-col z-10 flex-shrink-0" style={{ height: panelHeight }}>
      {/* Resize handle */}
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
                {tab.badge && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none ${
                    activeTab === tab.id ? 'bg-blue-500/20 text-blue-400' : 'bg-surface border border-border text-text-muted'
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
              onChange={e => setShell(e.target.value)}
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

      {/* Panel content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'inspector' && (
          <InspectorPanel
            selectedNode={selectedNode}
            preferredIde={preferredIde}
            workspacePath={workspacePath}
            edges={edges}
            onRefactorClick={onRefactorClick}
            onPropTrace={onPropTrace}
          />
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

        {activeTab === 'matrix' && <MatrixPanel edges={edges} />}
      </div>
    </div>
  );
}
