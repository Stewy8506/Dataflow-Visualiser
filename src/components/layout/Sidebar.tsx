import { FolderGit2, GitBranch, GitCommit, Network, Settings, FileText, LifeBuoy } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function NavItem({ icon, label, active }: NavItemProps) {
  return (
    <button
      className={cn(
        "w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
        active
          ? "bg-slate-700/50 text-white shadow-sm"
          : "text-text-muted hover:bg-slate-800/50 hover:text-slate-200"
      )}
    >
      <span className={cn("opacity-80", active && "opacity-100 text-blue-400")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function Sidebar() {
  return (
    <div className="w-64 h-full bg-[#111115] border-r border-slate-800 flex flex-col z-10 flex-shrink-0">
      <div className="p-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Main-Branch</h2>
        <p className="text-xs text-text-muted mt-1 uppercase tracking-wider font-semibold">Active Project</p>
      </div>

      <div className="flex-1 px-3 space-y-1">
        <NavItem icon={<FolderGit2 size={18} />} label="Explorer" />
        <NavItem icon={<GitBranch size={18} />} label="Branches" />
        <NavItem icon={<GitCommit size={18} />} label="Commits" />
        <NavItem icon={<Network size={18} />} label="Network" active />
        <NavItem icon={<Settings size={18} />} label="Settings" />
      </div>

      <div className="p-3 space-y-1 border-t border-slate-800">
        <NavItem icon={<FileText size={18} />} label="Documentation" />
        <NavItem icon={<LifeBuoy size={18} />} label="Support" />
        
        <div className="pt-4 pb-2 px-1">
          <button className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-lg transition-colors font-medium text-sm cursor-pointer shadow-sm">
            Connect Repository
          </button>
        </div>
      </div>
    </div>
  );
}
