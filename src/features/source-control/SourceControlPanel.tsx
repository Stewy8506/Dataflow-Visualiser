import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitCommit, Plus, Minus, Check, User, Clock, X, FileText, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

interface GitCommitInfo {
  id: string;
  parents: string[];
  author: string;
  message: string;
  timestamp: number;
}

interface SourceControlPanelProps {
  workspacePath: string | null;
}

interface ParsedFileDiff {
  filePath: string;
  patchLines: string[];
}

const parseDiff = (rawDiff: string): ParsedFileDiff[] => {
  if (!rawDiff || rawDiff.startsWith('Error loading diff')) return [];
  const files: ParsedFileDiff[] = [];
  const parts = rawDiff.split(/^diff --git /m);
  
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split('\n');
    const firstLine = lines[0];
    const match = firstLine.match(/^a\/(.+?)\s+b\/(.+)$/);
    const filePath = match ? match[2] : firstLine.replace(/^a\//, '');
    
    files.push({
      filePath,
      patchLines: lines.slice(1)
    });
  }
  return files;
};

export function SourceControlPanel({ workspacePath }: SourceControlPanelProps) {
  const files = useAppStore(s => s.gitStatuses);
  const setGitStatuses = useAppStore(s => s.setGitStatuses);
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  
  // Hover & selection states
  const [hoveredCommit, setHoveredCommit] = useState<GitCommitInfo | null>(null);
  const [hoverY, setHoverY] = useState(0);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitInfo | null>(null);
  const [commitDiff, setCommitDiff] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);

  // Resizable timeline
  const [timelineHeight, setTimelineHeight] = useState(250);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const fetchData = async () => {
    if (!workspacePath) return;
    try {
      const statusPromise = invoke('get_git_status', { path: workspacePath });
      const historyPromise = invoke('get_git_history', { workspace: workspacePath });
      
      const [statusResult, historyResult] = await Promise.all([statusPromise, historyPromise]);
      setGitStatuses(statusResult as GitFileStatus[]);
      setCommits(historyResult as GitCommitInfo[]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [workspacePath]);

  const handleStage = async (path: string) => {
    if (!workspacePath) return;
    await invoke('git_stage_file', { workspace: workspacePath, path });
    fetchData();
  };

  const handleUnstage = async (path: string) => {
    if (!workspacePath) return;
    await invoke('git_unstage_file', { workspace: workspacePath, path });
    fetchData();
  };

  const handleCommit = async () => {
    if (!workspacePath || !message.trim()) return;
    setLoading(true);
    try {
      await invoke('git_commit', { workspace: workspacePath, message });
      setMessage('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSync = async () => {
    if (!workspacePath) return;
    setLoading(true);
    setSyncMessage(null);
    try {
      const result: { message: string; pulled: boolean; pushed: boolean } = await invoke('git_sync', { workspace: workspacePath });
      setSyncMessage(`${result.message}${result.pulled ? ' after fast-forward pull' : ''}${result.pushed ? ' and push' : ''}.`);
      fetchData();
    } catch (e) {
      setSyncMessage(`Sync failed: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCommitClick = async (commit: GitCommitInfo) => {
    setSelectedCommit(commit);
    if (!workspacePath) return;
    
    setDiffLoading(true);
    setCommitDiff(null);
    try {
      const diff: string = await invoke('get_commit_diff', { 
        workspace: workspacePath, 
        commitId: commit.id 
      });
      setCommitDiff(diff);
    } catch (e) {
      console.error("Failed to fetch commit diff:", e);
      setCommitDiff(`Error loading diff: ${String(e)}`);
    } finally {
      setDiffLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = timelineHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 200, startHeight.current + delta));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => !f.staged);
  const isSyncMode = stagedFiles.length === 0 && unstagedFiles.length === 0;

  const parsedDiffs = useMemo(() => {
    if (!commitDiff) return [];
    return parseDiff(commitDiff);
  }, [commitDiff]);

  useEffect(() => {
    if (parsedDiffs.length > 0) {
      setSelectedDiffFile(parsedDiffs[0].filePath);
    } else {
      setSelectedDiffFile(null);
    }
  }, [parsedDiffs]);

  if (!workspacePath) {
    return <div className="p-4 text-xs text-text-dim">No workspace selected.</div>;
  }

  return (
    <>
      <div className="w-64 h-full bg-surface border-r border-border flex flex-col text-sm animate-fade-in relative z-20">
        <div className="p-3 border-b border-border font-semibold text-text-main flex items-center gap-2 flex-shrink-0">
          <GitCommit size={16} className="text-text-dim" />
          Source Control
        </div>

        <div className="p-3 border-b border-border flex flex-col gap-2 flex-shrink-0">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message (Cmd+Enter to commit)"
            className="w-full bg-surface-raised border border-border rounded text-xs p-2 text-text-main focus:outline-none focus:border-text-dim resize-none"
            rows={3}
          />
          <button
            onClick={isSyncMode ? handleSync : handleCommit}
            disabled={loading || (!isSyncMode && (stagedFiles.length === 0 || !message.trim()))}
            className="w-full bg-text-main text-background py-1.5 rounded text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-1"
          >
            {loading ? (
              isSyncMode ? 'Syncing...' : 'Committing...'
            ) : isSyncMode ? (
              <><RefreshCw size={14} /> Sync to main</>
            ) : (
              <><Check size={14} /> Commit</>
            )}
          </button>
          {syncMessage && (
            <div className={`text-[10px] leading-relaxed ${syncMessage.startsWith('Sync failed') ? 'text-rose-400' : 'text-text-dim'}`}>
              {syncMessage}
            </div>
          )}
        </div>

        {/* Changes Area */}
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
                    onClick={() => handleUnstage(file.path)}
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
                onClick={() => handleStage(file.path)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-border rounded text-text-dim hover:text-text-main cursor-pointer"
                  title="Stage"
                >
                  <Plus size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Resizer Handle */}
        <div 
          className="h-1.5 w-full cursor-row-resize flex items-center justify-center group hover:bg-surface-raised transition-colors flex-shrink-0 border-y border-border"
          onMouseDown={handleMouseDown}
        >
          <div className="w-8 h-0.5 bg-border-accent group-hover:bg-text-dim rounded-full transition-colors" />
        </div>

        {/* Timeline Area */}
        <div className="flex flex-col flex-shrink-0 overflow-y-auto p-2" style={{ height: timelineHeight }}>
          <div className="text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-2 px-1 pb-1">Timeline</div>
          <div className="relative pl-2 mt-1">
            <div className="absolute left-[12px] top-2 bottom-2 w-px bg-border-accent z-0" />
            <div className="flex flex-col gap-1 relative z-10">
              {commits.map((commit) => (
                <div 
                  key={commit.id} 
                  onMouseEnter={(e) => {
                    setHoveredCommit(commit);
                    setHoverY(e.clientY);
                  }}
                  onMouseLeave={() => setHoveredCommit(null)}
                  onClick={() => handleCommitClick(commit)}
                  className="flex gap-3 items-start group cursor-pointer hover:bg-surface-raised p-1 rounded transition-colors"
                >
                  <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center relative mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-background border-2 border-text-dim group-hover:border-primary transition-colors z-10" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs text-text-main truncate group-hover:text-primary transition-colors">
                      {commit.message || 'Empty commit'}
                    </span>
                    <span className="text-[10px] text-text-dim flex items-center gap-1 mt-0.5">
                      <User size={10} /> {commit.author}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hover Popover */}
      {hoveredCommit && !selectedCommit && (
        <div 
          className="fixed left-[310px] w-80 bg-surface border border-border shadow-2xl rounded-lg p-4 z-50 pointer-events-none"
          style={{ top: Math.max(20, Math.min(window.innerHeight - 150, hoverY - 50)) }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
              {hoveredCommit.author.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text-main">{hoveredCommit.author}</span>
              <span className="text-[10px] text-text-dim flex items-center gap-1 mt-0.5">
                <Clock size={10} /> {formatDate(hoveredCommit.timestamp)}
              </span>
            </div>
          </div>
          <div className="text-sm text-text-main font-medium mb-3 leading-snug">
            {hoveredCommit.message}
          </div>
          <div className="text-[10px] font-mono text-text-dim mt-2 pt-2 border-t border-border flex justify-between items-center">
            <span>{hoveredCommit.id}</span>
          </div>
        </div>
      )}

      {/* Diff Modal (By File) */}
      {selectedCommit && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-surface w-full max-w-6xl h-full max-h-[85vh] border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between glass-panel shrink-0">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-text-main truncate pr-4">{selectedCommit.message}</span>
                <span className="text-xs text-text-dim mt-0.5 font-mono">{selectedCommit.id} • {selectedCommit.author}</span>
              </div>
              <button 
                onClick={() => setSelectedCommit(null)}
                className="p-1.5 rounded-md text-text-dim hover:text-text-main hover:bg-surface transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {diffLoading ? (
                <div className="p-8 text-text-dim animate-pulse w-full text-center flex items-center justify-center">Loading diff...</div>
              ) : commitDiff?.startsWith('Error loading') ? (
                <div className="p-8 text-red-400 font-mono text-sm w-full flex items-center justify-center">{commitDiff}</div>
              ) : parsedDiffs.length === 0 ? (
                <div className="p-8 text-text-dim italic w-full text-center flex items-center justify-center">No changes in this commit.</div>
              ) : (
                <>
                  {/* File List Sidebar */}
                  <div className="w-72 border-r border-border bg-surface-raised overflow-y-auto flex flex-col p-2 gap-1 shrink-0">
                    <div className="text-[10px] font-semibold text-text-dim uppercase tracking-wider px-2 py-2">Changed Files ({parsedDiffs.length})</div>
                    {parsedDiffs.map(file => (
                      <button
                        key={file.filePath}
                        onClick={() => setSelectedDiffFile(file.filePath)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer text-xs ${
                          selectedDiffFile === file.filePath 
                            ? 'bg-primary/20 text-primary font-medium' 
                            : 'text-text-dim hover:text-text-main hover:bg-surface'
                        }`}
                      >
                        <FileText size={12} className="shrink-0" />
                        <span className="truncate">{file.filePath}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Diff Content */}
                  <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed bg-[#0a0a0a] text-gray-300 p-4">
                    {parsedDiffs.find(f => f.filePath === selectedDiffFile)?.patchLines.map((line, i) => {
                      let colorClass = '';
                      if (line.startsWith('+')) colorClass = 'text-green-400 bg-green-500/10';
                      else if (line.startsWith('-')) colorClass = 'text-red-400 bg-red-500/10';
                      else if (line.startsWith('@@')) colorClass = 'text-blue-400';
                      
                      if (line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) return null;

                      return (
                        <div key={i} className={`px-2 py-0.5 whitespace-pre-wrap break-all ${colorClass}`}>
                          {line || ' '}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
