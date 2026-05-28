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
    <div className="absolute bottom-6 left-6 z-20 flex items-end">
      {/* Collapsed Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-all duration-300 shadow-2xl backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
          title="Open Layout Settings"
        >
          <Sliders size={20} className="animate-pulse" />
        </button>
      )}

      {/* Expanded Control Panel */}
      {isOpen && (
        <div className="bg-slate-950/90 border border-slate-800/80 text-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 transition-all duration-300 w-80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <LayoutList size={18} className="text-blue-400" />
              <h3 className="font-semibold text-sm tracking-wide text-slate-100">Layout Settings</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleReset}
                className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Reset layout defaults"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Collapse Panel"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Flow Direction Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase block">Flow Direction</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDirection('LR')}
                  className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    direction === 'LR'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <ArrowRightLeft size={14} />
                  <span>Left to Right</span>
                </button>
                <button
                  onClick={() => setDirection('TB')}
                  className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    direction === 'TB'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <ArrowUpDown size={14} />
                  <span>Top to Bottom</span>
                </button>
              </div>
            </div>

            {/* Horizontal Spread (Ranksep) Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-400 tracking-wider uppercase">
                  {direction === 'LR' ? 'Horizontal Spread' : 'Vertical Spacing'}
                </label>
                <span className="font-mono text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded">
                  {ranksep}px
                </span>
              </div>
              <input
                type="range"
                min="150"
                max="800"
                step="25"
                value={ranksep}
                onChange={(e) => setRanksep(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>150px (Compact)</span>
                <span>800px (Wide)</span>
              </div>
            </div>

            {/* Vertical Separation (Nodesep) Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-400 tracking-wider uppercase">
                  {direction === 'LR' ? 'Vertical Compactness' : 'Horizontal Compactness'}
                </label>
                <span className="font-mono text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded">
                  {nodesep}px
                </span>
              </div>
              <input
                type="range"
                min="40"
                max="300"
                step="10"
                value={nodesep}
                onChange={(e) => setNodesep(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>40px (Dense)</span>
                <span>300px (Spacious)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
