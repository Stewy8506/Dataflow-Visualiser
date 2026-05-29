import { Settings, Box, Spline, Layers, Server, Layout, Map, Package, History, Flame, Sun, Moon, Maximize2, Minimize2 } from 'lucide-react';
import type { GraphLayer } from '../../types';

interface EditorToolbarProps {
  viewMode: '2d' | '3d';
  onViewModeChange: (mode: '2d' | '3d') => void;
  activeLayer: GraphLayer;
  onLayerChange: (layer: GraphLayer) => void;
  onSettingsClick?: () => void;
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function EditorToolbar({ 
  viewMode, onViewModeChange, activeLayer, onLayerChange, onSettingsClick, 
  isLightMode, setIsLightMode, showMiniMap, setShowMiniMap, 
  showExternalDeps, setShowExternalDeps, showSnapshots, setShowSnapshots, 
  showHeatmap, setShowHeatmap, isFullscreen, onToggleFullscreen
}: EditorToolbarProps) {
  const layerItems: { key: GraphLayer; icon: typeof Layout; label: string }[] = [
    { key: 'ui', icon: Layout, label: 'UI Layer' },
    { key: 'backend', icon: Server, label: 'Backend' },
    { key: 'overall', icon: Layers, label: 'Overall' },
  ];

  return (
    <div className="h-10 bg-surface border-b border-border flex items-center justify-between px-3 shrink-0">
      {/* Left side: View Mode and Layers */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-background rounded-md border border-border-subtle p-0.5">
          <button
            onClick={() => onViewModeChange('2d')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '2d'
                ? 'bg-surface-raised text-text-main shadow-sm border border-border'
                : 'text-text-dim hover:text-text-muted border border-transparent'
            }`}
          >
            <Spline size={13} />
            <span>2D Flow</span>
          </button>
          <button
            onClick={() => onViewModeChange('3d')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '3d'
                ? 'bg-surface-raised text-text-main shadow-sm border border-border'
                : 'text-text-dim hover:text-text-muted border border-transparent'
            }`}
          >
            <Box size={13} />
            <span>3D View</span>
          </button>
        </div>

        {/* Divider */}
        {viewMode === '2d' && <div className="w-px h-4 bg-border mx-1" />}

        {/* Layer Switcher */}
        {viewMode === '2d' && (
          <div className="flex items-center bg-background rounded-md border border-border-subtle p-0.5">
            {layerItems.map(({ key, icon: Icon, label }) => {
              const isActive = activeLayer === key;
              return (
                <button
                  key={key}
                  onClick={() => onLayerChange(key)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-surface-raised text-text-main shadow-sm border border-border'
                      : 'text-text-dim hover:text-text-muted border border-transparent'
                  }`}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right side: Tools and Actions */}
      <div className="flex items-center gap-1">
        {viewMode === '2d' && setShowMiniMap && (
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              showMiniMap 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'text-text-dim hover:text-text-main hover:bg-surface-raised'
            }`}
            title="Toggle Mini Map"
          >
            <Map size={14} />
          </button>
        )}

        {viewMode === '2d' && setShowExternalDeps && (
          <button
            onClick={() => setShowExternalDeps(!showExternalDeps)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              showExternalDeps 
                ? 'bg-fuchsia-500/20 text-fuchsia-400' 
                : 'text-text-dim hover:text-text-main hover:bg-surface-raised'
            }`}
            title="Toggle External Dependencies"
          >
            <Package size={14} />
          </button>
        )}

        {viewMode === '2d' && setShowHeatmap && (
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              showHeatmap 
                ? 'bg-orange-500/20 text-orange-400' 
                : 'text-text-dim hover:text-text-main hover:bg-surface-raised'
            }`}
            title="Toggle Git Churn Heatmap"
          >
            <Flame size={14} />
          </button>
        )}

        {setShowSnapshots && (
          <button
            onClick={() => setShowSnapshots(!showSnapshots)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              showSnapshots 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-text-dim hover:text-text-main hover:bg-surface-raised'
            }`}
            title="Snapshots & Diffing"
          >
            <History size={14} />
          </button>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        <button
          onClick={() => setIsLightMode(!isLightMode)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim hover:text-text-main hover:bg-surface-raised transition-colors cursor-pointer"
          title="Toggle Theme"
        >
          {isLightMode ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim hover:text-text-main hover:bg-surface-raised transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen Graph" : "Fullscreen Graph"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}

        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim hover:text-text-main hover:bg-surface-raised transition-colors cursor-pointer ml-1"
            title="Settings"
          >
            <Settings size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
