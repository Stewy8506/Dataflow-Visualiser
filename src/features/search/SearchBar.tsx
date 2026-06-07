import { Search, X, Filter, ScanEye } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useShallow } from 'zustand/react/shallow';

export function SearchBar() {
    const { searchQuery, setSearchQuery, searchMode, setSearchMode } = useAppStore(
    useShallow((s) => ({
      searchQuery: s.searchQuery,
      setSearchQuery: s.setSearchQuery,
      searchMode: s.searchMode,
      setSearchMode: s.setSearchMode,
    }))
  );

  return (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-2 animate-slide-up">
      <div className="flex items-center glass-panel p-1 rounded-lg">
        <button
          onClick={() => setSearchMode('highlight')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
            searchMode === 'highlight'
              ? 'bg-surface-raised text-text-main shadow-sm border border-border'
              : 'text-text-dim hover:text-text-main border border-transparent'
          }`}
          title="Highlight Matching Nodes"
        >
          <ScanEye size={13} />
          <span>Highlight</span>
        </button>
        <button
          onClick={() => setSearchMode('collapse')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
            searchMode === 'collapse'
              ? 'bg-surface-raised text-text-main shadow-sm border border-border'
              : 'text-text-dim hover:text-text-main border border-transparent'
          }`}
          title="Hide Non-Matching Nodes"
        >
          <Filter size={13} />
          <span>Filter</span>
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          disabled
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-dim/40 cursor-not-allowed border border-transparent"
          title="UI Mode (Coming Soon)"
        >
          <ScanEye size={13} />
          <span>UI Mode <span className="text-[10px] opacity-60">(Soon)</span></span>
        </button>
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={14} className="text-text-dim group-focus-within:text-text-main transition-colors" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="glass-panel rounded-lg pl-9 pr-9 py-2 text-sm text-text-main outline-none focus:border-text-dim focus:bg-surface-raised w-56 transition-all placeholder:text-text-dim/60"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-dim hover:text-text-main cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
