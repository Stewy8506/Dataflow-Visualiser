import { useState } from 'react';
import { Box, Spline, Map, Package, History, Flame, Sun, Moon, Maximize2, Minimize2, Sparkles, Link, Beaker, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSettings } from '../../hooks/useSettings';

interface EditorToolbarProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function EditorToolbar({ isFullscreen, onToggleFullscreen }: EditorToolbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { 
    viewMode, setViewMode,
    showMiniMap, setShowMiniMap,
    showExternalDeps, setShowExternalDeps,
    showSnapshots, setShowSnapshots,
    showHeatmap, setShowHeatmap,
    showTestCoverage, setShowTestCoverage,
    showAiChat, setShowAiChat,
    showSemanticEdges, setShowSemanticEdges
  } = useAppStore();

  const { isLightMode, setIsLightMode } = useSettings();

  return (
    <div className="h-10 bg-surface border-b border-border flex items-center justify-between px-3 shrink-0">
      {/* Left side: View Mode and Layers */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="view-toggle-btn flex items-center bg-background rounded-md border border-border-subtle p-0.5">
          <button
            onClick={() => setViewMode('2d')}
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
            disabled
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium text-text-dim/40 cursor-not-allowed border border-transparent"
            title="3D View (Coming Soon)"
          >
            <Box size={13} />
            <span>3D View <span className="text-[10px] opacity-60">(Soon)</span></span>
          </button>
        </div>
      </div>

      {/* Right side: Tools and Actions */}
      <div className="flex items-center gap-1.5">
        {/* View Options Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all duration-200 cursor-pointer ${
              isDropdownOpen
                ? 'bg-surface-raised border-accent-primary text-text-main shadow-sm'
                : 'bg-background hover:bg-surface border-border text-text-muted hover:text-text-main'
            }`}
            title="View Options & Overlays"
          >
            <SlidersHorizontal size={12} />
            <span>View Options</span>
            <ChevronDown size={10} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <>
              {/* Click-away backdrop */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              
              {/* Dropdown Card */}
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-surface border border-border shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl p-3 z-50 space-y-1 nebula-slide-up">
                <span className="text-[9px] font-semibold text-text-dim uppercase tracking-wider block px-2 mb-1.5">
                  Visual Overlays
                </span>
                
                {/* 1. Minimap Toggle */}
                {viewMode === '2d' && setShowMiniMap && (
                  <button
                    onClick={() => { setShowMiniMap(!showMiniMap); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left text-text-main cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-text-muted">
                      <Map size={13} />
                      <span>Mini Map</span>
                    </div>
                    <div className={`nebula-switch-small ${showMiniMap ? 'active' : ''}`} />
                  </button>
                )}

                {/* 2. External Dependencies Toggle */}
                {viewMode === '2d' && setShowExternalDeps && (
                  <button
                    onClick={() => { setShowExternalDeps(!showExternalDeps); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left text-text-main cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-text-muted">
                      <Package size={13} />
                      <span>External Packages</span>
                    </div>
                    <div className={`nebula-switch-small ${showExternalDeps ? 'active' : ''}`} />
                  </button>
                )}

                {/* 3. Semantic Relationships Toggle */}
                {viewMode === '2d' && (
                  <button
                    onClick={() => { setShowSemanticEdges(!showSemanticEdges); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left text-text-main cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-text-muted">
                      <Link size={13} />
                      <span>Semantic Edges</span>
                    </div>
                    <div className={`nebula-switch-small ${showSemanticEdges ? 'active' : ''}`} />
                  </button>
                )}

                {/* 4. Git Churn Heatmap Toggle */}
                {viewMode === '2d' && setShowHeatmap && (
                  <button
                    onClick={() => { setShowHeatmap(!showHeatmap); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left text-text-main cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-text-muted">
                      <Flame size={13} />
                      <span>Git Churn Heatmap</span>
                    </div>
                    <div className={`nebula-switch-small ${showHeatmap ? 'active' : ''}`} />
                  </button>
                )}

                {/* 5. Test Coverage Toggle */}
                {viewMode === '2d' && (
                  <button
                    onClick={() => { setShowTestCoverage(!showTestCoverage); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left text-text-main cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-text-muted">
                      <Beaker size={13} />
                      <span>Test Coverage Overlay</span>
                    </div>
                    <div className={`nebula-switch-small ${showTestCoverage ? 'active' : ''}`} />
                  </button>
                )}

                {/* 6. Version Snapshots Toggle */}
                {setShowSnapshots && (
                  <button
                    onClick={() => { setShowSnapshots(!showSnapshots); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left text-text-main cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-text-muted">
                      <History size={13} />
                      <span>Version Snapshots</span>
                    </div>
                    <div className={`nebula-switch-small ${showSnapshots ? 'active' : ''}`} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowAiChat(!showAiChat)}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
            showAiChat 
              ? 'bg-blue-600/20 text-blue-400' 
              : 'text-text-dim hover:text-text-main hover:bg-surface-raised'
          }`}
          title="Toggle AI Assistant"
        >
          <Sparkles size={14} />
        </button>

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

      </div>
    </div>
  );
}
