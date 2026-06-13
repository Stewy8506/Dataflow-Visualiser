import { Settings, Box, Spline, Layers, Server, Layout, Sparkles, Sun, Moon, Map, FolderOpen, Package, History, Flame } from 'lucide-react';

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
  showExternalDeps?: boolean;
  setShowExternalDeps?: (val: boolean) => void;
  showSnapshots?: boolean;
  setShowSnapshots?: (val: boolean) => void;
  showHeatmap?: boolean;
  setShowHeatmap?: (val: boolean) => void;
  showTests?: boolean;
  setShowTests?: (val: boolean) => void;
  showSemanticEdges?: boolean;
  setShowSemanticEdges?: (val: boolean) => void;
}

export function Header({ viewMode, onViewModeChange, activeLayer, onLayerChange, onSettingsClick, onChangeDirectory, isLightMode, setIsLightMode, showMiniMap, setShowMiniMap, showExternalDeps, setShowExternalDeps, showSnapshots, setShowSnapshots, showHeatmap, setShowHeatmap, showTests, setShowTests, showSemanticEdges, setShowSemanticEdges }: HeaderProps) {
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
          Dataflow Visualiser
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

        {/* External Deps Toggle */}
        {viewMode === '2d' && setShowExternalDeps && (
          <button
            onClick={() => setShowExternalDeps(!showExternalDeps)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              showExternalDeps 
                ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' 
                : 'text-text-dim hover:text-text-main hover:bg-glass-light border border-transparent'
            }`}
            title="Toggle External Dependencies"
          >
            <Package size={15} />
          </button>
        )}

        {/* Heatmap Toggle */}
        {viewMode === '2d' && setShowHeatmap && (
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              showHeatmap 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                : 'text-text-dim hover:text-text-main hover:bg-glass-light border border-transparent'
            }`}
            title="Toggle Git Churn Heatmap"
          >
            <Flame size={15} />
          </button>
        )}

        {/* Tests Toggle */}
        {viewMode === '2d' && setShowTests && (
          <button
            onClick={() => setShowTests(!showTests)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              showTests 
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                : 'text-text-dim hover:text-text-main hover:bg-glass-light border border-transparent'
            }`}
            title="Toggle Tests & Mocks"
          >
            <div className="font-bold text-xs flex items-center justify-center">T</div>
          </button>
        )}

        {/* Semantic Edges Toggle */}
        {viewMode === '2d' && setShowSemanticEdges && (
          <button
            onClick={() => setShowSemanticEdges(!showSemanticEdges)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              showSemanticEdges 
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                : 'text-text-dim hover:text-text-main hover:bg-glass-light border border-transparent'
            }`}
            title="Toggle Semantic/Custom Edges"
          >
            <div className="font-bold text-xs flex items-center justify-center">S</div>
          </button>
        )}

        {/* Snapshots Toggle */}
        {setShowSnapshots && (
          <button
            onClick={() => setShowSnapshots(!showSnapshots)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              showSnapshots 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'text-text-dim hover:text-text-main hover:bg-glass-light border border-transparent'
            }`}
            title="Snapshots & Diffing"
          >
            <History size={16} />
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
