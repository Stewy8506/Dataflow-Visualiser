import { Settings, Box, Spline, Layers, Server, Layout, Sparkles, Sun, Moon, Map, FolderOpen } from 'lucide-react';

export type GraphLayer = 'ui' | 'backend' | 'overall';

interface HeaderProps {
  viewMode: '2d' | '3d';
  onViewModeChange: (mode: '2d' | '3d') => void;
  activeLayer: GraphLayer;
  onLayerChange: (layer: GraphLayer) => void;
  onSettingsClick?: () => void;
  onChangeDirectory?: () => void;
  isLightMode: boolean;
  setIsLightMode: (val: boolean) => void;
  showMiniMap?: boolean;
  setShowMiniMap?: (val: boolean) => void;
}

export function Header({ viewMode, onViewModeChange, activeLayer, onLayerChange, onSettingsClick, onChangeDirectory, isLightMode, setIsLightMode, showMiniMap, setShowMiniMap }: HeaderProps) {
  const layerItems: { key: GraphLayer; icon: typeof Layout; label: string }[] = [
    { key: 'ui', icon: Layout, label: 'UI Layer' },
    { key: 'backend', icon: Server, label: 'Backend' },
    { key: 'overall', icon: Layers, label: 'Overall' },
  ];

  return (
    <header className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-xl glass-panel shadow-md animate-slide-up">
      {/* Logo */}
      <div className="flex items-center gap-2 pr-3 border-r border-border">
        <Sparkles size={16} className="text-blue-400" />
        <span className="text-sm font-bold tracking-tight text-text-main">
          CodeMapper
        </span>
      </div>

      {/* Layer Switcher — only in 2D */}
      {viewMode === '2d' && (
        <div className="flex items-center gap-0.5 bg-surface/60 p-1 rounded-lg border border-border-subtle">
          {layerItems.map(({ key, icon: Icon, label }) => {
            const isActive = activeLayer === key;
            return (
              <button
                key={key}
                onClick={() => onLayerChange(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-surface-raised text-text-main shadow-sm border border-border'
                    : 'text-text-dim hover:text-text-muted border border-transparent'
                }`}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center bg-surface/60 p-1 rounded-lg border border-border-subtle">
        <button
          onClick={() => onViewModeChange('2d')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
            viewMode === '2d'
              ? 'bg-surface-raised text-text-main shadow-sm border border-border'
              : 'text-text-dim hover:text-text-muted border border-transparent'
          }`}
        >
          <Spline size={13} />
          <span>Flow</span>
        </button>
        <button
          onClick={() => onViewModeChange('3d')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
            viewMode === '3d'
              ? 'bg-surface-raised text-text-main shadow-sm border border-border'
              : 'text-text-dim hover:text-text-muted border border-transparent'
          }`}
        >
          <Box size={13} />
          <span>3D</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Change Directory */}
        {onChangeDirectory && (
          <button
            onClick={onChangeDirectory}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-dim hover:text-text-main hover:bg-glass-light transition-all duration-200 cursor-pointer"
            title="Change Project Directory"
          >
            <FolderOpen size={16} />
          </button>
        )}
        {/* Map Toggle */}
        {viewMode === '2d' && setShowMiniMap && (
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              showMiniMap 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'text-text-dim hover:text-text-main hover:bg-glass-light border border-transparent'
            }`}
            title="Toggle Mini Map"
          >
            <Map size={15} />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setIsLightMode(!isLightMode)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-dim hover:text-text-main hover:bg-glass-light transition-all duration-200 cursor-pointer"
          title="Toggle Theme"
        >
          {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-dim hover:text-text-main hover:bg-glass-light transition-all duration-200 cursor-pointer"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
