import { useState } from 'react';
import { X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BottomPanelProps {
  selectedNode: any | null;
  logs: string[];
}

export function BottomPanel({ selectedNode, logs }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<'inspector' | 'matrix' | 'console'>('inspector');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs = [
    { id: 'inspector', label: 'Node Inspector' },
    { id: 'matrix', label: 'Dependency Matrix' },
    { id: 'console', label: 'Console Logs' },
  ] as const;

  if (isCollapsed) {
    return (
      <div 
        className="h-10 border-t border-slate-800 bg-[#111115] flex items-center justify-center px-4 z-10 flex-shrink-0 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex items-center space-x-2 text-text-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">Show Panel</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 border-t border-slate-800 bg-[#111115] flex flex-col z-10 flex-shrink-0">
      {/* Tabs */}
      <div className="flex items-center justify-between px-4 border-b border-slate-800/50 bg-[#111115]">
        <div className="flex space-x-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "py-3 text-sm font-medium transition-colors border-b-2 cursor-pointer",
                activeTab === tab.id
                  ? "border-white text-white"
                  : "border-transparent text-text-muted hover:text-slate-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex space-x-2">
          <button 
            className="text-slate-500 hover:text-white p-2 cursor-pointer transition-colors"
            onClick={() => setIsCollapsed(true)}
            title="Minimize"
          >
            <div className="w-3 h-0.5 bg-current" />
          </button>
          <button 
            className="text-slate-500 hover:text-white p-2 cursor-pointer transition-colors"
            onClick={() => setIsCollapsed(true)}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'inspector' && (
          <>
            {/* Inspector Left */}
            <div className="w-80 border-r border-slate-800/50 p-6 flex flex-col overflow-y-auto">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
                SELECTED: {selectedNode ? selectedNode.data?.label.toUpperCase() : 'NONE'}
              </h3>
              
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-sm text-slate-400">Type</span>
                    <span className="text-sm font-medium text-white">{selectedNode.data?.subLabel || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-sm text-slate-400">Size</span>
                    <span className="text-sm font-medium text-white">
                      {Math.floor(Math.random() * 100) + 5} KB
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-sm text-slate-400">Complexity</span>
                    <span className="text-sm font-medium text-white">Medium (O(n))</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">
                  Select a node in the flow view to inspect details.
                </div>
              )}
            </div>
            
            {/* Inspector Right (Console preview) */}
            <div className="flex-1 p-6 bg-[#0a0a0c] font-mono text-sm overflow-y-auto">
              <div className="text-slate-300 mb-4 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Analysis complete. 0 structural anomalies detected.</span>
              </div>
              
              <div className="space-y-1 text-slate-500">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'console' && (
           <div className="flex-1 p-6 bg-[#0a0a0c] font-mono text-sm overflow-y-auto">
             <div className="space-y-1 text-slate-400">
               {logs.map((log, i) => (
                 <div key={i}>{log}</div>
               ))}
             </div>
           </div>
        )}

        {activeTab === 'matrix' && (
          <div className="flex-1 p-6 flex items-center justify-center text-slate-500">
            Dependency Matrix View (Coming Soon)
          </div>
        )}
      </div>
    </div>
  );
}
