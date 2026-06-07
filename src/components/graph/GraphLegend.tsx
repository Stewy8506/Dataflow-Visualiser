import { useState } from 'react';
import { Info, X, Image as ImageIcon } from 'lucide-react';

const legendItems = [
  { color: '#3b82f6', label: 'UI Component', desc: 'TSX / JSX files' },
  { color: '#f59e0b', label: 'Script / Logic', desc: 'TS / JS / PY files' },
  { color: '#10b981', label: 'Backend', desc: 'API, server, Rust backend' },
  { color: '#94a3b8', label: 'Other', desc: 'Config, assets, etc.' },
];

const edgeLegend = [
  { color: '#334155', style: 'solid', label: 'Import dependency' },
  { color: '#ef4444', style: 'solid', label: 'Blast Tier 1 — Breaking' },
  { color: '#f97316', style: 'solid', label: 'Blast Tier 2 — Major' },
  { color: '#eab308', style: 'solid', label: 'Blast Tier 3 — Minor' },
];

const badgeLegend = [
  { emoji: '💀', label: 'Dead Code', desc: 'No imports found' },
  { label: 'Cx: High', color: 'text-red-400', desc: 'High complexity' },
  { label: 'Cx: Medium', color: 'text-amber-400', desc: 'Medium complexity' },
  { label: 'Cx: Low', color: 'text-emerald-400', desc: 'Low complexity' },
  { emoji: '🧪', label: 'Test Coverage', desc: 'Code coverage %' },
];

export function GraphLegend({ onExportPng }: { onExportPng?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2">
        {onExportPng && (
          <button
            onClick={onExportPng}
            className="w-9 h-9 flex items-center justify-center rounded-xl glass-panel text-text-dim hover:text-text-main transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
            title="Export as PNG"
          >
            <ImageIcon size={16} />
          </button>
        )}
        <button
          onClick={() => setIsOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl glass-panel text-text-dim hover:text-text-main transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
          title="Show Legend"
        >
          <Info size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 right-4 z-20 w-64 glass-panel rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] nebula-slide-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-text-main">Legend</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 text-text-dim hover:text-text-main rounded-md hover:bg-surface-raised transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <div className="p-3 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Node colors */}
        <div>
          <span className="text-[9px] font-semibold text-text-dim uppercase tracking-wider block mb-2">Node Types</span>
          <div className="space-y-1.5">
            {legendItems.map(item => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-sm border shrink-0"
                  style={{ borderColor: item.color, borderLeftWidth: '3px' }}
                />
                <div className="flex flex-col">
                  <span className="text-[11px] text-text-main font-medium">{item.label}</span>
                  <span className="text-[9px] text-text-dim">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Edge colors */}
        <div>
          <span className="text-[9px] font-semibold text-text-dim uppercase tracking-wider block mb-2">Edge Colors</span>
          <div className="space-y-1.5">
            {edgeLegend.map(item => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className="w-5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] text-text-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="col-span-1 space-y-3">
          <h4 className="text-[9px] font-bold text-text-dim tracking-wider uppercase mb-2">Metrics & Flow</h4>
          <div className="flex items-center gap-2">
            <div className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Cx: Low</div>
            <span className="text-[10px] text-text-muted">Low Complexity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20">Cx: High</div>
            <span className="text-[10px] text-text-muted">High Complexity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0 border-t border-dashed border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
            <span className="text-[10px] text-text-muted">Circular Dep</span>
          </div>
        </div>

        {/* Badges */}
        <div>
          <span className="text-[9px] font-semibold text-text-dim uppercase tracking-wider block mb-2">Badges</span>
          <div className="space-y-1.5">
            {badgeLegend.map(item => (
              <div key={item.label} className="flex items-center gap-2.5">
                {item.emoji ? (
                  <span className="text-[11px] shrink-0 w-5 text-center">{item.emoji}</span>
                ) : (
                  <span className={`text-[9px] font-bold shrink-0 w-5 text-center ${item.color}`}>Cx</span>
                )}
                <div className="flex flex-col">
                  <span className="text-[11px] text-text-main font-medium">{item.label}</span>
                  <span className="text-[9px] text-text-dim">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
