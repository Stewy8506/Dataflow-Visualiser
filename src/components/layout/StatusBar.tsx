import { FolderGit2, GitBranch, TerminalSquare, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StatusBarProps {
  workspacePath: string | null;
  logsCount: number;
  isParsing: boolean;
  isEnriching: boolean;
  preferredIde: string;
}

export function StatusBar({ workspacePath, logsCount, isParsing, isEnriching, preferredIde }: StatusBarProps) {
  // Extract project name from path
  const projectName = workspacePath ? workspacePath.split(/[\\/]/).pop() : 'No Workspace';

  return (
    <div className="h-6 bg-surface border-t border-border flex items-center justify-between px-3 text-[11px] text-text-dim flex-shrink-0 select-none">
      {/* Left side */}
      <div className="flex items-center gap-3 h-full">
        {/* Workspace info */}
        <div className="flex items-center gap-1.5 hover:text-text-main transition-colors cursor-pointer h-full px-1">
          <FolderGit2 size={12} />
          <span>{projectName}</span>
        </div>

        {/* Git info (mocked or static for now unless we hook up real git branch) */}
        {workspacePath && (
          <div className="flex items-center gap-1.5 hover:text-text-main transition-colors cursor-pointer h-full px-1">
            <GitBranch size={12} />
            <span>main</span>
          </div>
        )}

        {/* Sync/Status */}
        {(isParsing || isEnriching) ? (
          <div className="flex items-center gap-1.5 text-blue-400 h-full px-1">
            <div className="w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>{isEnriching ? 'Enriching...' : 'Analyzing...'}</span>
          </div>
        ) : workspacePath ? (
          <div className="flex items-center gap-1.5 hover:text-text-main transition-colors cursor-pointer h-full px-1">
            <CheckCircle2 size={12} />
            <span>Ready</span>
          </div>
        ) : null}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 h-full">
        {/* Error/Warning counts (mocked for now, can hook up later) */}
        <div className="flex items-center gap-1 hover:text-text-main transition-colors cursor-pointer h-full px-1">
          <AlertCircle size={12} />
          <span>0</span>
        </div>

        {/* Terminal/Logs count */}
        <div className="flex items-center gap-1.5 hover:text-text-main transition-colors cursor-pointer h-full px-1">
          <TerminalSquare size={12} />
          <span>{logsCount} Logs</span>
        </div>

        {/* IDE info */}
        <div className="flex items-center gap-1.5 hover:text-text-main transition-colors cursor-pointer h-full px-1">
          <span className="uppercase tracking-wider font-semibold opacity-70">IDE:</span>
          <span>{preferredIde}</span>
        </div>
      </div>
    </div>
  );
}
