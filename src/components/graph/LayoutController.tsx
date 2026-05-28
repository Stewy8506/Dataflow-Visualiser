import { useState } from 'react';
import { Sliders, ChevronLeft, LayoutList, ArrowRightLeft, ArrowUpDown, RotateCcw } from 'lucide-react';

interface LayoutControllerProps {
  nodesep: number;
  setNodesep: (val: number) => void;
  ranksep: number;
  setRanksep: (val: number) => void;
  direction: 'LR' | 'TB';
  setDirection: (dir: 'LR' | 'TB') => void;
}

export function LayoutController({
  nodesep,
  setNodesep,
  ranksep,
  setRanksep,
  direction,
  setDirection,
}: LayoutControllerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReset = () => {
    setNodesep(70);
    setRanksep(400);
    setDirection('LR');
  };

  return (
    <div className="absolute bottom-6 left-16 z-20 flex items-end">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-xl nebula-glass text-text-dim hover:text-text-main transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
          title="Layout Settings"
        >
          <Sliders size={18} />
        </button>
      )}

      {isOpen && (
        <div className="nebula-glass rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 w-80 nebula-slide-up">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <div className="flex items-center gap-2">
              <LayoutList size={16} className="text-blue-400" />
              <h3 className="font-semibold text-sm text-text-main">Layout</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 text-text-dim hover:text-text-muted hover:bg-surface-raised rounded-md transition-colors cursor-pointer"
                title="Reset defaults"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-text-dim hover:text-text-muted hover:bg-surface-raised rounded-md transition-colors cursor-pointer"
                title="Collapse"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-text-dim tracking-wider uppercase block">Direction</label>
              <div className="grid grid-cols-2 gap-1.5 bg-surface/60 p-1 rounded-lg border border-border-subtle">
                <button
                  onClick={() => setDirection('LR')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                    direction === 'LR'
                      ? 'bg-surface-raised text-text-main shadow-sm border border-border'
                      : 'text-text-dim hover:text-text-muted border border-transparent'
                  }`}
                >
                  <ArrowRightLeft size={13} />
                  <span>Horizontal</span>
                </button>
                <button
                  onClick={() => setDirection('TB')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                    direction === 'TB'
                      ? 'bg-surface-raised text-text-main shadow-sm border border-border'
                      : 'text-text-dim hover:text-text-muted border border-transparent'
                  }`}
                >
                  <ArrowUpDown size={13} />
                  <span>Vertical</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-text-dim tracking-wider uppercase">
                  {direction === 'LR' ? 'Horizontal Spread' : 'Vertical Spacing'}
                </label>
                <span className="font-mono text-[11px] text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded">
                  {ranksep}px
                </span>
              </div>
              <input
                type="range" min="150" max="800" step="25"
                value={ranksep}
                onChange={(e) => setRanksep(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-text-dim font-mono">
                <span>150 (Compact)</span>
                <span>800 (Wide)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-text-dim tracking-wider uppercase">
                  {direction === 'LR' ? 'Vertical Compactness' : 'Horizontal Compactness'}
                </label>
                <span className="font-mono text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded">
                  {nodesep}px
                </span>
              </div>
              <input
                type="range" min="40" max="300" step="10"
                value={nodesep}
                onChange={(e) => setNodesep(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-text-dim font-mono">
                <span>40 (Dense)</span>
                <span>300 (Spacious)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
