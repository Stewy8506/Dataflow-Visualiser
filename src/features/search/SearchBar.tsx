import { useState } from 'react';
import { Search, X, Filter, ScanEye } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useShallow } from 'zustand/react/shallow';

export function SearchBar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { searchQuery, setSearchQuery, searchMode, setSearchMode } = useAppStore(
    useShallow((s) => ({
      searchQuery: s.searchQuery,
      setSearchQuery: s.setSearchQuery,
      searchMode: s.searchMode,
      setSearchMode: s.setSearchMode,
    }))
  );

  return (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-2 animate-slide-up select-none">
      {/* Standalone floating UI Mode button (disabled) */}
      <button
        disabled
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-text-dim/40 bg-surface/80 border border-border-subtle cursor-not-allowed shadow-md shrink-0"
        title="UI Mode (Coming Soon)"
      >
        <ScanEye size={13} />
        <span>UI Mode <span className="text-[9px] opacity-60">(Soon)</span></span>
      </button>

      {/* Search Input Box with integrated mode dropdown */}
      <div className="relative flex items-center gap-1.5 bg-surface/90 border border-border rounded-lg px-2.5 py-1.5 shadow-lg">
        <div className="relative flex items-center flex-1">
          <Search size={14} className="text-text-dim mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="bg-transparent border-0 text-xs text-text-main outline-none w-48 placeholder:text-text-dim/60 font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-text-dim hover:text-text-main cursor-pointer px-1 shrink-0"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="w-px h-4 bg-border shrink-0 mx-0.5" />

        {/* Dropdown trigger */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors text-text-dim hover:text-text-main hover:bg-surface-raised cursor-pointer ${
              isDropdownOpen ? 'bg-surface-raised text-text-main' : ''
            }`}
            title="Search Settings & Modes"
          >
            {searchMode === 'collapse' ? <Filter size={13} /> : <ScanEye size={13} />}
          </button>

          {isDropdownOpen && (
            <>
              {/* Click-away backdrop */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              
              {/* Dropdown Card */}
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface border border-border shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl p-2 z-50 space-y-0.5 nebula-slide-up select-none">
                <span className="text-[9px] font-semibold text-text-dim uppercase tracking-wider block px-2 mb-1.5">
                  Search Action Mode
                </span>
                <button
                  onClick={() => { setSearchMode('highlight'); setIsDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left cursor-pointer ${
                    searchMode === 'highlight' 
                      ? 'text-accent-primary font-medium bg-accent-primary/10' 
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ScanEye size={12} />
                    <span>Highlight Matches</span>
                  </div>
                </button>
                <button
                  onClick={() => { setSearchMode('collapse'); setIsDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-surface-raised transition-colors text-left cursor-pointer ${
                    searchMode === 'collapse' 
                      ? 'text-accent-primary font-medium bg-accent-primary/10' 
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Filter size={12} />
                    <span>Hide Non-Matches</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
