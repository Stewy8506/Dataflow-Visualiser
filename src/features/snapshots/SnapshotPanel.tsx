import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Save, History, SplitSquareHorizontal, CheckCircle2, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';

interface SnapshotMeta {
  name: string;
  timestamp: string;
  node_count: number;
  edge_count: number;
}

export interface SnapshotDiff {
  added_nodes: string[];
  removed_nodes: string[];
  added_edges: [string, string][];
  removed_edges: [string, string][];
}

interface SnapshotPanelProps {
  workspacePath: string;
  graphData: any; // Used to save
  onClose: () => void;
  onApplyDiff: (diff: SnapshotDiff | null) => void;
}

export function SnapshotPanel({ workspacePath, graphData, onClose, onApplyDiff }: SnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [activeTab, setActiveTab] = useState<'save' | 'history' | 'diff'>('history');
  
  // Save State
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Diff State
  const [snapshotA, setSnapshotA] = useState<string>('');
  const [snapshotB, setSnapshotB] = useState<string>('');
  const [isDiffing, setIsDiffing] = useState(false);
  const [currentDiff, setCurrentDiff] = useState<SnapshotDiff | null>(null);

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    try {
      const list: SnapshotMeta[] = await invoke('list_snapshots', { workspacePath });
      setSnapshots(list);
    } catch (e) {
      console.error("Failed to load snapshots", e);
    }
  };

  const handleSave = async () => {
    if (!newSnapshotName.trim()) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await invoke('save_snapshot', {
        workspacePath,
        name: newSnapshotName.trim(),
        graphData
      });
      setSaveSuccess(true);
      setNewSnapshotName('');
      await loadSnapshots();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to save snapshot", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiff = async () => {
    if (!snapshotA || !snapshotB) return;
    setIsDiffing(true);
    try {
      const diff: SnapshotDiff = await invoke('diff_snapshots', {
        workspacePath,
        aName: snapshotA,
        bName: snapshotB
      });
      setCurrentDiff(diff);
      onApplyDiff(diff);
    } catch (e) {
      console.error("Failed to diff snapshots", e);
    } finally {
      setIsDiffing(false);
    }
  };

  const clearDiff = () => {
    setCurrentDiff(null);
    onApplyDiff(null);
  };

  const handleDeleteSnapshot = async (name: string) => {
    try {
      await invoke('delete_snapshot', { workspacePath, name });
      if (snapshotA === name) setSnapshotA('');
      if (snapshotB === name) setSnapshotB('');
      await loadSnapshots();
    } catch (e) {
      console.error("Failed to delete snapshot", e);
    }
  };

  return (
    <div className="absolute top-16 right-4 z-50 w-96 bg-surface border border-border shadow-[0_24px_64px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden flex flex-col nebula-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-raised">
        <div className="flex items-center gap-2">
          <History size={18} className="text-blue-400" />
          <h2 className="text-sm font-bold text-text-main">Architecture Snapshots</h2>
        </div>
        <button onClick={onClose} className="text-text-dim hover:text-text-main transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-2 bg-surface border-b border-border-subtle gap-1">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'history' ? 'bg-surface-raised text-text-main shadow-sm' : 'text-text-dim hover:text-text-main'}`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('save')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'save' ? 'bg-surface-raised text-text-main shadow-sm' : 'text-text-dim hover:text-text-main'}`}
        >
          Save New
        </button>
        <button
          onClick={() => setActiveTab('diff')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'diff' ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/20' : 'text-text-dim hover:text-text-main'}`}
        >
          <SplitSquareHorizontal size={12} /> Diff
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[400px] overflow-y-auto bg-background min-h-[250px]">
        
        {activeTab === 'history' && (
          <div className="space-y-3">
            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-text-dim text-xs italic">
                No snapshots saved yet.
              </div>
            ) : (
              snapshots.map((snap, i) => (
                <div key={i} className="p-3 bg-surface border border-border-subtle rounded-lg flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-text-main truncate">{snap.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-text-dim font-mono">{new Date(snap.timestamp).toLocaleDateString()}</span>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.name)}
                        className="p-1 rounded text-text-dim hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete snapshot"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted font-mono">
                    <span>{snap.node_count} nodes</span>
                    <span>{snap.edge_count} edges</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'save' && (
          <div className="space-y-4 flex flex-col h-full justify-center">
            <div className="bg-surface-raised p-4 rounded-xl border border-border-subtle text-center">
              <Save className="mx-auto mb-2 text-text-muted" size={24} />
              <p className="text-xs text-text-dim leading-relaxed">
                Save a snapshot of your current architecture graph. You can diff against this later to see how the codebase has evolved.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Snapshot Name</label>
              <input
                type="text"
                value={newSnapshotName}
                onChange={e => setNewSnapshotName(e.target.value)}
                placeholder="e.g., v1.0.0-release or before-refactor"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-blue-500/50"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!newSnapshotName.trim() || isSaving}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? "Saving..." : saveSuccess ? <><CheckCircle2 size={16} /> Saved!</> : "Save Snapshot"}
            </button>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="space-y-4">
            {snapshots.length < 2 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">You need at least 2 snapshots to perform a diff. Go to the Save tab to create them.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Base (A)</label>
                    <select
                      value={snapshotA}
                      onChange={e => setSnapshotA(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-main outline-none"
                    >
                      <option value="">Select...</option>
                      {snapshots.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <ArrowRight size={14} className="text-text-muted mt-5" />
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Target (B)</label>
                    <select
                      value={snapshotB}
                      onChange={e => setSnapshotB(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-main outline-none"
                    >
                      <option value="">Select...</option>
                      {snapshots.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleDiff}
                    disabled={!snapshotA || !snapshotB || snapshotA === snapshotB || isDiffing}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20"
                  >
                    {isDiffing ? "Computing..." : "Apply Diff Overlay"}
                  </button>
                  {currentDiff && (
                    <button
                      onClick={clearDiff}
                      className="px-3 py-2 bg-surface-raised hover:bg-surface-raised/80 border border-border rounded-lg text-xs font-medium text-text-main transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {currentDiff && (
                  <div className="bg-surface-raised p-3 rounded-lg border border-border-subtle space-y-2 mt-4">
                    <h3 className="text-xs font-bold text-text-main border-b border-border-subtle pb-2">Diff Summary</h3>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-emerald-400">+{currentDiff.added_nodes.length} Nodes</span>
                      <span className="text-rose-400">-{currentDiff.removed_nodes.length} Nodes</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-emerald-400">+{currentDiff.added_edges.length} Edges</span>
                      <span className="text-rose-400">-{currentDiff.removed_edges.length} Edges</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
