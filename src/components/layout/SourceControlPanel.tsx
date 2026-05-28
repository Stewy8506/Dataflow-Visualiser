import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitCommit, Plus, Minus, Check } from 'lucide-react';

interface GitFileStatus {
  path: String;
  status: String;
  staged: boolean;
}

interface SourceControlPanelProps {
  workspacePath: string | null;
}

export function SourceControlPanel({ workspacePath }: SourceControlPanelProps) {
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    if (!workspacePath) return;
    try {
      const result: GitFileStatus[] = await invoke('get_git_status', { path: workspacePath });
      setFiles(result);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [workspacePath]);

  const handleStage = async (path: string) => {
    if (!workspacePath) return;
    await invoke('git_stage_file', { workspace: workspacePath, path });
    fetchStatus();
  };

  const handleUnstage = async (path: string) => {
    if (!workspacePath) return;
    await invoke('git_unstage_file', { workspace: workspacePath, path });
    fetchStatus();
  };

  const handleCommit = async () => {
    if (!workspacePath || !message.trim()) return;
    setLoading(true);
    try {
      await invoke('git_commit', { workspace: workspacePath, message });
      setMessage('');
      fetchStatus();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => !f.staged);

  if (!workspacePath) {
    return <div className="p-4 text-xs text-text-dim">No workspace selected.</div>;
  }

  return (
    <div className="w-64 h-full bg-surface border-r border-border flex flex-col text-sm animate-fade-in">
      <div className="p-3 border-b border-border font-semibold text-text-main flex items-center gap-2">
        <GitCommit size={16} className="text-text-dim" />
        Source Control
      </div>

      <div className="p-3 border-b border-border flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (Cmd+Enter to commit)"
          className="w-full bg-surface-raised border border-border rounded text-xs p-2 text-text-main focus:outline-none focus:border-text-dim resize-none"
          rows={3}
        />
        <button
          onClick={handleCommit}
          disabled={loading || stagedFiles.length === 0 || !message.trim()}
          className="w-full bg-text-main text-background py-1.5 rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-1"
        >
          {loading ? 'Committing...' : <><Check size={14} /> Commit</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {stagedFiles.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-2 px-1">Staged Changes</div>
            {stagedFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between group p-1 hover:bg-surface-raised rounded cursor-default">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className={`text-[10px] w-3 flex-shrink-0 text-center font-bold ${file.status === 'Added' || file.status === 'Untracked' ? 'text-green-500' : file.status === 'Deleted' ? 'text-red-500' : 'text-blue-500'}`}>
                    {file.status.charAt(0)}
                  </span>
                  <span className="text-xs text-text-main truncate">{file.path}</span>
                </div>
                <button
                  onClick={() => handleUnstage(file.path as string)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-border rounded text-text-dim hover:text-text-main cursor-pointer"
                  title="Unstage"
                >
                  <Minus size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4">
          <div className="text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-2 px-1">Changes</div>
          {unstagedFiles.length === 0 && <div className="text-xs text-text-dim px-1 italic">No changes.</div>}
          {unstagedFiles.map((file, i) => (
            <div key={i} className="flex items-center justify-between group p-1 hover:bg-surface-raised rounded cursor-default">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`text-[10px] w-3 flex-shrink-0 text-center font-bold ${file.status === 'Added' || file.status === 'Untracked' ? 'text-green-500' : file.status === 'Deleted' ? 'text-red-500' : 'text-blue-500'}`}>
                  {file.status.charAt(0)}
                </span>
                <span className="text-xs text-text-main truncate">{file.path}</span>
              </div>
              <button
                onClick={() => handleStage(file.path as string)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-border rounded text-text-dim hover:text-text-main cursor-pointer"
                title="Stage"
              >
                <Plus size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
