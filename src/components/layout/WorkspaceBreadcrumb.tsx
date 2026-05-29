import { FolderOpen, ChevronRight } from 'lucide-react';

interface WorkspaceBreadcrumbProps {
  path: string;
  onChangeDirectory: () => void;
}

export function WorkspaceBreadcrumb({ path, onChangeDirectory }: WorkspaceBreadcrumbProps) {
  // Normalize separators and split into segments
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  
  // Show last 3 segments for brevity
  const displaySegments = segments.slice(-3);
  const isClipped = segments.length > 3;

  return (
    <div className="absolute top-[68px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg glass-panel shadow-sm animate-fade-in">
      <FolderOpen size={13} className="text-text-dim shrink-0" />
      
      <div className="flex items-center gap-1 text-[11px] font-mono">
        {isClipped && (
          <>
            <span className="text-text-dim">…</span>
            <ChevronRight size={10} className="text-text-dim/50" />
          </>
        )}
        {displaySegments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={10} className="text-text-dim/50" />}
            <span className={i === displaySegments.length - 1 ? 'text-text-main font-semibold' : 'text-text-dim'}>
              {seg}
            </span>
          </span>
        ))}
      </div>

      <button
        onClick={onChangeDirectory}
        className="ml-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim hover:text-text-main bg-surface-raised hover:bg-surface-overlay border border-border-subtle rounded-md transition-all duration-200 cursor-pointer"
      >
        Change
      </button>
    </div>
  );
}
