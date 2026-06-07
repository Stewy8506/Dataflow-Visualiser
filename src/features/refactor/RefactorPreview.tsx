import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, FileEdit, AlertTriangle, CheckCircle2, Sparkles, FileCode, RefreshCw } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { DiffEditor } from '@monaco-editor/react';

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
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [modifiedContent, setModifiedContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [refactoringStep, setRefactoringStep] = useState<'idle' | 'planning' | 'coding' | 'reviewing' | 'complete'>('idle');
  const [aiUpdates, setAiUpdates] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { apiKey, selectedModel, aiProvider, localBaseUrl } = useSettings();

  const targetFilename = targetPath.split(/[/\\]/).pop() || '';

  const runPreview = async () => {
    setRefactoringStep('planning');
    setError(null);
    setAiUpdates(null);
    setSelectedFilePath(null);
    try {
      const result: RefactorImpact = await invoke('preview_refactor', {
        workspacePath,
        targetPath,
        newName: newName || 'NewName',
        symbolName: symbolName ? symbolName : null,
      });
      setImpact(result);
      if (result.affected_files.length > 0) {
        setSelectedFilePath(result.affected_files[0].path);
      }
      setRefactoringStep('idle');
    } catch (err) {
      setError(String(err));
      setRefactoringStep('idle');
    }
  };

  useEffect(() => {
    runPreview();
  }, []);

  // Set first file as selected when impact loads
  useEffect(() => {
    if (impact && impact.affected_files.length > 0 && !selectedFilePath) {
      setSelectedFilePath(impact.affected_files[0].path);
    }
  }, [impact]);

  // Load selected file contents for side-by-side diff
  useEffect(() => {
    if (!selectedFilePath) {
      setOriginalContent('');
      setModifiedContent('');
      return;
    }

    const loadFileContent = async () => {
      setContentLoading(true);
      try {
        const content = await invoke<string>('read_file_content', {
          workspace: workspacePath,
          path: selectedFilePath,
        });
        setOriginalContent(content);

        // Check if we have an AI update for this file
        const aiUpdate = aiUpdates?.find(u => u.path === selectedFilePath);
        if (aiUpdate) {
          setModifiedContent(aiUpdate.new_content);
        } else {
          // Simulate local rename edits in code preview
          let modified = content;
          if (symbolName) {
            try {
              const escaped = symbolName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              modified = content.replace(new RegExp(`\\b${escaped}\\b`, 'g'), newName || 'NewName');
            } catch (e) {
              modified = content.replace(symbolName, newName || 'NewName');
            }
          } else {
            const targetStem = targetFilename.replace(/\.[^/.]+$/, "");
            const newStem = (newName || 'NewName').replace(/\.[^/.]+$/, "");
            try {
              const escaped = targetStem.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              modified = content.replace(new RegExp(`\\b${escaped}\\b`, 'g'), newStem);
            } catch (e) {
              modified = content.replace(targetStem, newStem);
            }
          }
          setModifiedContent(modified);
        }
      } catch (err) {
        console.error("Failed to read file content:", err);
        setOriginalContent('');
        setModifiedContent('');
      } finally {
        setContentLoading(false);
      }
    };

    loadFileContent();
  }, [selectedFilePath, aiUpdates, workspacePath, symbolName, newName, targetFilename]);

  const handleGenerateRefactor = async () => {
    if (!impact || impact.affected_files.length === 0) return;
    if (aiProvider === 'gemini' && !apiKey) {
      setError("Gemini API key is required to execute AI refactoring.");
      return;
    }
    if (aiProvider === 'local' && !localBaseUrl) {
      setError("Local AI base URL is required to execute AI refactoring.");
      return;
    }
    
    setRefactoringStep('coding');
    setError(null);
    try {
      const affectedFilePaths = impact.affected_files.map(f => f.path);
      
      const updates: any[] = await invoke('execute_ai_refactor', {
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
      
      setAiUpdates(updates);
      setRefactoringStep('reviewing');
    } catch (err) {
      setError(String(err));
      setRefactoringStep('idle');
    }
  };

  const handleApplyRefactor = async () => {
    if (!aiUpdates) return;
    setRefactoringStep('complete');
    try {
      await invoke('apply_ai_refactor', { workspacePath, updates: aiUpdates });
    } catch (err) {
      setError(String(err));
      setRefactoringStep('reviewing');
    }
  };

  const getLang = (path: string | null) => {
    if (!path) return 'javascript';
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
    return 'javascript';
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center nebula-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-[95vw] max-w-6xl h-[85vh] flex flex-col bg-surface border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] nebula-slide-up overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-surface-raised">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <FileEdit className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main leading-tight">Refactor Preview & Split Diff</h2>
              <p className="text-xs text-text-dim mt-0.5 font-mono truncate max-w-xl">{targetPath}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-dim hover:text-text-main hover:bg-surface rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex min-h-0 bg-background">
          
          {/* Left Column: Config + Scrollable Affected Files Selector */}
          <div className="w-80 border-r border-border-subtle bg-surface flex flex-col min-h-0">
            {/* Config Box */}
            <div className="p-4 border-b border-border-subtle space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-dim tracking-wider uppercase block">New Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New filename..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-blue-500/50 transition-colors font-medium"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-dim tracking-wider uppercase block">Specific Symbol (Optional)</label>
                <input
                  type="text"
                  value={symbolName}
                  onChange={(e) => setSymbolName(e.target.value)}
                  placeholder="e.g. MyComponent"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-blue-500/50 transition-colors font-medium"
                />
              </div>

              <button
                onClick={runPreview}
                disabled={refactoringStep !== 'idle'}
                className="w-full flex items-center justify-center gap-2 bg-background hover:bg-surface-raised border border-border py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 text-text-main"
              >
                <RefreshCw size={14} className={refactoringStep === 'planning' ? 'animate-spin' : ''} />
                {refactoringStep === 'planning' ? "Planning..." : "Recalculate Blast"}
              </button>
            </div>

            {/* Affected Files List Selector */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 py-3 bg-surface-raised/40 border-b border-border-subtle flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-dim tracking-wider uppercase">Affected Files</span>
                {impact && (
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded">
                    {impact.total_files} files
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {refactoringStep === 'planning' ? (
                  <div className="py-12 text-center text-xs text-text-dim flex flex-col items-center gap-2">
                    <RefreshCw className="animate-spin text-blue-400" size={16} />
                    <span>Mapping dependencies...</span>
                  </div>
                ) : impact && impact.affected_files.length === 0 ? (
                  <div className="py-12 text-center text-xs text-text-dim">
                    No references found. Safe to rename.
                  </div>
                ) : impact ? (
                  impact.affected_files.map((file) => {
                    const isSelected = selectedFilePath === file.path;
                    const parts = file.path.split('/');
                    const dirPath = parts.slice(0, -1).join('/');
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFilePath(file.path)}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 cursor-pointer select-none group ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                            : 'bg-transparent border-transparent hover:bg-surface-raised text-text-dim hover:text-text-main'
                        }`}
                      >
                        <FileCode size={16} className={isSelected ? 'text-blue-400' : 'text-text-muted group-hover:text-text-dim'} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-400' : 'text-text-main'}`}>
                            {file.label}
                          </div>
                          <div className="text-[9px] text-text-muted font-mono truncate mt-0.5">
                            {dirPath || '.'}
                          </div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 ${
                          isSelected
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-surface-raised text-text-muted group-hover:text-text-dim'
                        }`}>
                          {file.estimated_line_changes}
                        </span>
                      </button>
                    );
                  })
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Column: Code Diff Screen */}
          <div className="flex-1 flex flex-col min-h-0 bg-background relative">
            {refactoringStep === 'planning' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-text-dim gap-3 bg-background/80 backdrop-blur-sm z-10">
                <div className="w-8 h-8 border-2 border-surface-raised border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm font-medium">Computing refactoring blast radius...</span>
              </div>
            ) : refactoringStep === 'coding' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-text-dim gap-3 bg-background/80 backdrop-blur-sm z-10">
                <div className="w-8 h-8 border-2 border-surface-raised border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-sm font-medium">AI Drafting changes (full update)...</span>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/90 z-10">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 max-w-md">
                  <AlertTriangle size={20} className="shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            ) : refactoringStep === 'complete' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-400 gap-4 bg-background/95 z-10">
                <CheckCircle2 size={48} className="animate-pulse text-emerald-400" />
                <h3 className="text-xl font-bold">Refactor Applied!</h3>
                <p className="text-sm text-text-dim max-w-sm text-center">
                  Changes written successfully. Let's verify compilation.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 px-6 py-2 bg-surface-raised border border-border hover:bg-surface text-text-main rounded-lg transition-colors cursor-pointer text-sm font-semibold"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : null}

            {/* Panel Header */}
            {selectedFilePath ? (
              <div className="p-4 py-3 bg-surface-raised/40 border-b border-border-subtle flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-text-main font-mono truncate">{selectedFilePath}</span>
                  {aiUpdates ? (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded uppercase">
                      AI Generated
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded uppercase">
                      Local Rename Draft
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-text-muted font-mono shrink-0">
                  {getLang(selectedFilePath).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-dim text-sm bg-background">
                Select a file from the sidebar list to inspect the diff.
              </div>
            )}

            {/* Monaco Side-by-Side Diff Viewer */}
            {selectedFilePath && (
              <div className="flex-1 relative overflow-hidden">
                {contentLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                    <RefreshCw className="animate-spin text-blue-400" size={20} />
                  </div>
                ) : (
                  <DiffEditor
                    height="100%"
                    language={getLang(selectedFilePath)}
                    original={originalContent}
                    modified={modifiedContent}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      renderSideBySide: true,
                      fontFamily: 'var(--theme-mono-font), monospace',
                      fontSize: 12,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                      },
                      renderOverviewRuler: false,
                      diffWordWrap: 'off',
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border-subtle bg-surface flex items-center justify-between gap-3 shrink-0">
          {impact ? (
            <div className="text-xs text-text-dim flex items-center gap-2 font-medium pl-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <span>
                Affects <span className="font-bold text-text-main">{impact.total_files}</span> files, with <span className="font-bold text-text-main">{impact.total_estimated_changes}</span> changes.
              </span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors cursor-pointer font-medium"
            >
              Cancel
            </button>
            {refactoringStep === 'reviewing' ? (
              <button
                onClick={handleApplyRefactor}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 size={16} />
                Approve & Apply
              </button>
            ) : (
              <button
                onClick={handleGenerateRefactor}
                disabled={!impact || impact.total_files === 0 || refactoringStep !== 'idle'}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                {refactoringStep === 'coding' ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {refactoringStep === 'coding' ? "Generating Code..." : "Draft AI Refactor"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

