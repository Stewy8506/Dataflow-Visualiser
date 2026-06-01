import { useState } from 'react';
import { FolderGit2, GitBranch, GitCommit, Network, Settings, FileText, LifeBuoy, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function NavItem({ icon, label, active, disabled, onClick }: NavItemProps) {
  return (
    <div className="relative group">
      <button
        disabled={disabled}
        onClick={onClick}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
          disabled
            ? 'text-text-dim/40 cursor-not-allowed'
            : active
              ? 'text-text-main bg-surface-raised'
              : 'text-text-dim hover:text-text-main hover:bg-surface-raised cursor-pointer'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-text-main rounded-r-full" />
        )}
        {icon}
      </button>
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 glass-panel text-text-main shadow-lg">
        {label}
        {disabled && <span className="text-text-dim ml-1">(Soon)</span>}
      </div>
    </div>
  );
}

import { useAppStore } from '../../store/appStore';

export function Sidebar() {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-5 h-10 flex items-center justify-center rounded-r-md bg-surface border border-l-0 border-border text-text-dim hover:text-text-main transition-all duration-200 cursor-pointer shadow-sm"
      >
        <ChevronsRight size={12} />
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-[52px] h-full flex flex-col items-center py-4 bg-surface border-r border-border z-20">
      {/* App Icon */}
      <div className="w-8 h-8 rounded bg-text-main flex items-center justify-center mb-6 shadow-sm">
        <Network size={16} className="text-background" />
      </div>

      <div className="flex-1 flex flex-col items-center space-y-2">
        <NavItem 
          icon={<Network size={18} />} 
          label="Network" 
          active={activeTab === 'network'} 
          onClick={() => setActiveTab('network')} 
        />
        <NavItem 
          icon={<GitCommit size={18} />} 
          label="Source Control" 
          active={activeTab === 'source-control'} 
          onClick={() => setActiveTab('source-control')} 
        />
        <NavItem 
          icon={<FolderGit2 size={18} />} 
          label="Explorer" 
          active={activeTab === 'explorer'}
          onClick={() => setActiveTab('explorer')}
        />
        <NavItem icon={<GitBranch size={18} />} label="Branches" disabled />
        <NavItem icon={<Settings size={18} />} label="Settings" disabled />
      </div>

      <div className="flex flex-col items-center space-y-2 pt-4 border-t border-border">
        <NavItem icon={<FileText size={18} />} label="Documentation" disabled />
        <NavItem icon={<LifeBuoy size={18} />} label="Support" disabled />
        <button
          onClick={() => setCollapsed(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-text-dim hover:text-text-main hover:bg-surface-raised transition-colors cursor-pointer mt-2"
          title="Collapse"
        >
          <ChevronsLeft size={14} />
        </button>
      </div>
    </div>
  );
}
