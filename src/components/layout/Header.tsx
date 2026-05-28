import { Settings, HelpCircle, User, Box, Spline } from 'lucide-react';

interface HeaderProps {
  viewMode: '2d' | '3d';
  onViewModeChange: (mode: '2d' | '3d') => void;
}

export function Header({ viewMode, onViewModeChange }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800 bg-[#111115]/80 backdrop-blur flex items-center justify-between px-6 z-10 flex-shrink-0">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-white tracking-tight">CodeMapper</h1>
        
        <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => onViewModeChange('2d')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '2d' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Spline size={14} />
            <span>Flow View</span>
          </button>
          <button
            onClick={() => onViewModeChange('3d')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '3d' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box size={14} />
            <span>3D View</span>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="text-slate-400 hover:text-white transition-colors cursor-pointer p-2">
          <Settings size={20} />
        </button>
        <button className="text-slate-400 hover:text-white transition-colors cursor-pointer p-2">
          <HelpCircle size={20} />
        </button>
        <button className="text-slate-400 hover:text-white transition-colors cursor-pointer p-2">
          <User size={20} />
        </button>
      </div>
    </header>
  );
}
