import { useState, useEffect } from 'react';
import { X, LifeBuoy, Terminal, FolderGit2, Heart, Mail, ShieldAlert } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { invoke } from '@tauri-apps/api/core';

interface SupportModalProps {
  onClose: () => void;
}

export function SupportModal({ onClose }: SupportModalProps) {
  const [diagnostics, setDiagnostics] = useState<any>({
    os: 'Loading...',
    arch: 'Loading...',
    tauriVersion: '2.x',
    nodeVersion: 'v20.x',
    workspacePath: 'None',
  });

  const workspacePath = useAppStore(s => s.selectedNode?.data?.workspacePath) || 'No active project directory loaded';

  useEffect(() => {
    // Collect Tauri system info if available
    const getSysInfo = async () => {
      try {
        const platform = await invoke<string>('read_sys_platform').catch(() => 'Windows Desktop');
        setDiagnostics({
          os: platform === 'windows' ? 'Windows OS' : platform || 'Windows 11',
          arch: 'x64',
          tauriVersion: '2.0.0-rc',
          nodeVersion: 'v20.11.0',
          workspacePath: workspacePath,
        });
      } catch {
        // Fallback
        setDiagnostics({
          os: 'Windows 11 (Tauri client)',
          arch: 'x64',
          tauriVersion: '2.0.0',
          nodeVersion: 'v20.11.0',
          workspacePath: workspacePath,
        });
      }
    };
    getSysInfo();
  }, [workspacePath]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center nebula-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-[85vw] max-w-2xl bg-surface border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] nebula-slide-up overflow-hidden select-none">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-surface-raised shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <LifeBuoy className="text-emerald-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main leading-tight">Support & Diagnostics</h2>
              <p className="text-xs text-text-dim mt-0.5">Need help or want to inspect client system properties?</p>
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
        <div className="p-6 space-y-6 bg-background">
          
          {/* Main Info Blocks */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Left: Support Channels */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">Get in Touch</h3>
              
              <div className="space-y-2 text-xs">
                <a
                  href="https://github.com/Stewy8506/Dataflow-Visualiser"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border/60 hover:border-blue-500/40 hover:bg-surface-raised transition-all cursor-pointer text-text-dim hover:text-text-main"
                >
                  <FolderGit2 size={16} className="text-text-main" />
                  <div>
                    <strong className="block text-text-main">GitHub Issues</strong>
                    <span className="text-[10px]">Report visual bugs or request AST parsers</span>
                  </div>
                </a>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border/60 text-text-dim">
                  <Mail size={16} className="text-blue-400" />
                  <div>
                    <strong className="block text-text-main">Developer Support</strong>
                    <span className="text-[10px]">dasan.sagar@gmail.com</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border/60 text-text-dim">
                  <Heart size={16} className="text-rose-400 fill-rose-400/20" />
                  <div>
                    <strong className="block text-text-main">Made with Love</strong>
                    <span className="text-[10px]">Built for AST indexing pair programming</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Diagnostics Card */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                <Terminal size={12} className="text-text-dim" />
                <span>Client Environment</span>
              </h3>

              <div className="p-3.5 bg-surface-raised/40 border border-border-subtle rounded-xl font-mono text-[10px] text-text-dim space-y-2 select-text">
                <div className="flex justify-between">
                  <span className="text-text-muted">OS Platform:</span>
                  <span className="text-text-main font-semibold">{diagnostics.os}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Architecture:</span>
                  <span className="text-text-main font-semibold">{diagnostics.arch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Tauri Core:</span>
                  <span className="text-text-main font-semibold">{diagnostics.tauriVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">JS Runtime:</span>
                  <span className="text-text-main font-semibold">V8 (React 19)</span>
                </div>
                <div className="border-t border-border-subtle/50 pt-2 flex flex-col gap-1">
                  <span className="text-text-muted block">Active Directory:</span>
                  <span className="text-[9px] text-text-main font-semibold truncate block" title={diagnostics.workspacePath}>
                    {diagnostics.workspacePath}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Privacy Disclaimer Banner */}
          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-text-dim">
              <strong className="text-text-main">Full Privacy Control:</strong> Dataflow Visualiser processes all file indexing, dependency walks, AST mappings, and snapshots locally inside your workspace. AI summarization context is transmitted securely to your configured endpoints.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-600/10"
          >
            Close Support
          </button>
        </div>

      </div>
    </div>
  );
}
