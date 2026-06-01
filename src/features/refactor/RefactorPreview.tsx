import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Search, FileEdit, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

interface RefactorMatch {
  line: number;
  column: number;
  context: string;
  match_type: string;
}

interface AffectedFile {
  path: string;
  label: string;
  matches: RefactorMatch[];
  estimated_line_changes: number;
}

interface RefactorImpact {
  affected_files: AffectedFile[];
  total_files: number;
  total_estimated_changes: number;
}

interface RefactorPreviewProps {
  workspacePath: string;
  targetPath: string;
  initialSymbol?: string;
  onClose: () => void;
}

export function RefactorPreview({ workspacePath, targetPath, initialSymbol, onClose }: RefactorPreviewProps) {
  const [newName, setNewName] = useState('');
  const [symbolName, setSymbolName] = useState(initialSymbol || '');
  const [impact, setImpact] = useState<RefactorImpact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isRefactoring, setIsRefactoring] = useState(false);
  const [refactorComplete, setRefactorComplete] = useState(false);

  const { apiKey, selectedModel, aiProvider, localBaseUrl } = useSettings();

  const targetFilename = targetPath.split(/[/\\]/).pop() || '';

  const runPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result: RefactorImpact = await invoke('preview_refactor', {
        workspacePath,
        targetPath,
        newName: newName || 'NewName', // Fallback for preview
        symbolName: symbolName ? symbolName : null,
      });
      setImpact(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial run
    runPreview();
  }, []);

  const toggleFile = (path: string) => {
    setExpandedFiles((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleExecuteRefactor = async () => {
    if (!impact || impact.affected_files.length === 0) return;
    if (!apiKey) {
      setError("API Key is required to execute AI refactoring. Please set it in Settings.");
      return;
    }
    
    setIsRefactoring(true);
    setError(null);
    try {
      const affectedFilePaths = impact.affected_files.map(f => f.path);
      
      await invoke('execute_ai_refactor', {
        workspacePath,
        targetPath,
        newName: newName || 'NewName',
        symbolName: symbolName ? symbolName : null,
        apiKey,
        model: selectedModel || 'gemini-1.5-flash',
        affectedFiles: affectedFilePaths,
        aiProvider,
        localBaseUrl,
      });
      
      setRefactorComplete(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRefactoring(false);
    }
  };



  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center nebula-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 flex flex-col bg-surface border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] nebula-slide-up overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-surface-raised">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <FileEdit className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main leading-tight">Refactor Preview</h2>
              <p className="text-xs text-text-dim mt-0.5 font-mono truncate max-w-md">{targetFilename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-dim hover:text-text-main hover:bg-surface rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          
          {/* Left Sidebar - Inputs */}
          <div className="w-64 p-5 border-r border-border-subtle bg-surface flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">New Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New filename..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Specific Symbol (Optional)</label>
              <input
                type="text"
                value={symbolName}
                onChange={(e) => setSymbolName(e.target.value)}
                placeholder="e.g. MyComponent"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            <button
              onClick={runPreview}
              disabled={isLoading}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-surface-raised hover:bg-surface-raised/80 border border-border py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Search size={14} />
              {isLoading ? "Analyzing..." : "Refresh Preview"}
            </button>
          </div>

          {/* Right Area - Results */}
          <div className="flex-1 overflow-y-auto bg-background p-5">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-text-dim gap-3">
                <div className="w-8 h-8 border-2 border-surface-raised border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm font-medium">Computing blast radius...</span>
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={20} />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            ) : refactorComplete ? (
              <div className="h-full flex flex-col items-center justify-center text-emerald-400 gap-4">
                <CheckCircle2 size={48} className="animate-pulse" />
                <h3 className="text-xl font-bold">Refactor Applied Successfully!</h3>
                <p className="text-sm text-text-dim max-w-sm text-center">The dependent files have been updated by AI. Please review the changes in your IDE or source control.</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-2 bg-surface-raised border border-border hover:bg-surface text-text-main rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : impact ? (
              <div className="space-y-6">
                
                {/* Summary Banner */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-amber-400" size={20} />
                    <div>
                      <h3 className="text-sm font-bold text-amber-400">Estimated Impact</h3>
                      <p className="text-xs text-amber-400/80 mt-0.5">
                        Changing this will affect <span className="font-bold">{impact.total_files}</span> files and approximately <span className="font-bold">{impact.total_estimated_changes}</span> lines of code.
                      </p>
                    </div>
                  </div>
                </div>

                {/* File List */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-semibold text-text-dim tracking-wider uppercase pl-1">Affected Files</h3>
                  
                  {impact.affected_files.length === 0 ? (
                    <div className="text-center py-8 text-text-dim text-sm">
                      No dependent files found. Safe to rename.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {impact.affected_files.map((file: any, i: number) => (
                        <div key={i} className="bg-surface border border-border rounded-lg overflow-hidden">
                          {/* File Header */}
                          <div 
                            className="flex items-center justify-between p-3 hover:bg-surface-raised transition-colors cursor-pointer"
                            onClick={() => toggleFile(file.path)}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className="text-sm font-medium text-text-main">{file.label}</span>
                              <span className="text-[10px] text-text-muted font-mono truncate">{file.path}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {file.estimated_line_changes} lines
                              </span>
                            </div>
                          </div>

                          {/* File Details (Matches) */}
                          {expandedFiles.has(file.path) && (
                            <div className="border-t border-border-subtle bg-background/50 p-3 space-y-2">
                              {file.matches.map((match: any, j: number) => (
                                <div key={j} className="flex items-start gap-3 text-xs">
                                  <div className="w-8 text-right text-text-dim shrink-0 font-mono mt-0.5 select-none">{match.line}</div>
                                  <div className="flex-1 font-mono text-text-muted bg-surface-raised px-2 py-1.5 rounded overflow-x-auto whitespace-pre">
                                    {match.context}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors cursor-pointer font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteRefactor}
            disabled={!impact || impact.total_files === 0 || isRefactoring || refactorComplete}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
          >
            {isRefactoring ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {isRefactoring ? "Refactoring..." : "Execute AI Refactor"}
          </button>
        </div>

      </div>
    </div>
  );
}
