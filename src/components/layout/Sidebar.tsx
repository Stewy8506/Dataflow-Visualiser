import { useState } from 'react';
import { FolderGit2, GitBranch, GitCommit, Network, Settings, FileText, LifeBuoy, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}

function NavItem({ icon, label, active, disabled }: NavItemProps) {
  return (
    <div className="relative group">
      <button
        disabled={disabled}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
          disabled
            ? 'text-text-dim/40 cursor-not-allowed'
            : active
              ? 'text-blue-400 bg-blue-500/10'
              : 'text-text-dim hover:text-text-muted hover:bg-surface-raised cursor-pointer'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-blue-400 rounded-r-full" />
        )}
        {icon}
      </button>
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 nebula-glass text-text-main shadow-lg">
        {label}
        {disabled && <span className="text-text-dim ml-1">(Soon)</span>}
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-5 h-10 flex items-center justify-center rounded-r-md bg-surface border border-l-0 border-border text-text-dim hover:text-text-muted transition-all duration-200 cursor-pointer"
      >
        <ChevronsRight size={12} />
      </button>
    );
  }

  return (
    <div className="absolute left-0 top-0 bottom-0 w-[52px] z-30 flex flex-col items-center py-4 bg-surface/90 backdrop-blur-md border-r border-border">
      {/* App Icon */}
      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mb-6 shadow-md">
        <Network size={16} className="text-white" />
      </div>

      <div className="flex-1 flex flex-col items-center space-y-1">
        <NavItem icon={<Network size={18} />} label="Network" active />
        <NavItem icon={<FolderGit2 size={18} />} label="Explorer" disabled />
        <NavItem icon={<GitBranch size={18} />} label="Branches" disabled />
        <NavItem icon={<GitCommit size={18} />} label="Commits" disabled />
        <NavItem icon={<Settings size={18} />} label="Settings" disabled />
      </div>

      <div className="flex flex-col items-center space-y-1 pt-2 border-t border-border">
        <NavItem icon={<FileText size={18} />} label="Documentation" disabled />
        <NavItem icon={<LifeBuoy size={18} />} label="Support" disabled />
        <button
          onClick={() => setCollapsed(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-text-dim hover:text-text-muted hover:bg-surface-raised transition-colors cursor-pointer mt-2"
          title="Collapse"
        >
          <ChevronsLeft size={14} />
        </button>
      </div>
    </div>
  );
}
