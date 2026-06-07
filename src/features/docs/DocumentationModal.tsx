import { useState } from 'react';
import { X, BookOpen, Activity, Grid3x3, Keyboard, Settings, ChevronRight } from 'lucide-react';

interface DocumentationModalProps {
  onClose: () => void;
}

type Section = 'getting-started' | 'blast-radius' | 'coupling-matrix' | 'shortcuts' | 'settings';

export function DocumentationModal({ onClose }: DocumentationModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('getting-started');

  const navItems = [
    { id: 'getting-started', label: 'Getting Started', icon: <BookOpen size={16} /> },
    { id: 'blast-radius', label: 'Blast Radius Simulation', icon: <Activity size={16} /> },
    { id: 'coupling-matrix', label: 'Dependency Matrix', icon: <Grid3x3 size={16} /> },
    { id: 'settings', label: 'Aesthetics & Settings', icon: <Settings size={16} /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard size={16} /> },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center nebula-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-[85vw] max-w-4xl h-[75vh] flex flex-col bg-surface border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] nebula-slide-up overflow-hidden select-none">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-surface-raised shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <BookOpen className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main leading-tight">Documentation</h2>
              <p className="text-xs text-text-dim mt-0.5">Learn how to analyze, traverse, and refactor codebases</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-dim hover:text-text-main hover:bg-surface rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex min-h-0 bg-background">
          
          {/* Navigation Sidebar */}
          <div className="w-64 border-r border-border-subtle bg-surface flex flex-col p-3 gap-1 shrink-0">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as Section)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                      : 'bg-transparent border border-transparent text-text-dim hover:text-text-main hover:bg-surface-raised/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-blue-400' : 'text-text-dim'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight size={12} className={isActive ? 'text-blue-400' : 'text-text-dim/40'} />
                </button>
              );
            })}
          </div>

          {/* Docs Scrollable View */}
          <div className="flex-1 overflow-y-auto p-6 text-sm text-text-muted space-y-6">
            
            {activeSection === 'getting-started' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-text-main">Welcome to Dataflow Visualiser</h3>
                <p>
                  Dataflow Visualiser indexes local directories, extracts syntax dependencies using AST parsers, and builds a comprehensive interactive graph canvas to explore codebase architectures.
                </p>
                <div className="p-4 bg-surface-raised/40 border border-border-subtle rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">How to start analyzing:</h4>
                  <ul className="list-decimal pl-5 space-y-1.5 text-xs text-text-dim">
                    <li>Click <strong className="text-text-main">Open Folder...</strong> in the File menu or landing screen.</li>
                    <li>Select a local repository containing code files.</li>
                    <li>The parser walks the project Hidden/Git ignored rules, maps imports, and lays out file nodes visually.</li>
                  </ul>
                </div>
                <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">Graph Colors & Legend</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded bg-blue-500 mt-1 shrink-0" />
                    <div>
                      <strong className="text-text-main block">UI/Frontend Layer</strong>
                      <span>React, JSX/TSX views, layouts, and styles.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded bg-purple-500 mt-1 shrink-0" />
                    <div>
                      <strong className="text-text-main block">Backend Layer</strong>
                      <span>Rust handlers, Python APIs, data controllers, and services.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded bg-emerald-500 mt-1 shrink-0" />
                    <div>
                      <strong className="text-text-main block">Utilities & Core</strong>
                      <span>Pure helper functions, store configs, configurations, and assets.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded bg-fuchsia-500 mt-1 shrink-0" />
                    <div>
                      <strong className="text-text-main block">External Libraries</strong>
                      <span>Node modules and cargo crates dependencies boundaries.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'blast-radius' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-text-main">Blast Radius & Refactoring Preview</h3>
                <p>
                  Singly selecting a file node computes its **downstream propagation blast radius**. This instantly shows the files that depend on it directly or transitively.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <div className="text-red-400 text-xs font-bold uppercase tracking-wider">Tier 1 Impact</div>
                    <p className="text-[11px] text-text-dim mt-1">Directly imports the selected file. Immediate breaking risk.</p>
                  </div>
                  <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                    <div className="text-orange-400 text-xs font-bold uppercase tracking-wider">Tier 2 Impact</div>
                    <p className="text-[11px] text-text-dim mt-1">Imports a Tier 1 file. Indirect regression risk.</p>
                  </div>
                  <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                    <div className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Tier 3 Impact</div>
                    <p className="text-[11px] text-text-dim mt-1">Transitive dependency. Minor type adjustments might apply.</p>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">AI Refactoring Previews</h4>
                <p>
                  Triggering a refactor opens the split comparison viewer. The sidebar maps the affected files list, and the Monaco Editor displays the side-by-side modifications. Clicking "Draft AI Refactor" prompts Gemini to write semantic code updates across the full staging block.
                </p>
              </div>
            )}

            {activeSection === 'coupling-matrix' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-text-main">Intersections & Relationship Matrix</h3>
                <p>
                  The **Matrix Panel** renders an adjacency checkerboard grid representing source files on rows and target imports on columns. It acts as a visual dashboard for coupling metrics.
                </p>
                <div className="p-4 bg-surface-raised/40 border border-border-subtle rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">Double Import Circular Warning</h4>
                  <p className="text-xs text-text-dim">
                    If two files import each other reciprocally (creating a circular coupling loop), the matrix intersection block flashes in <strong className="text-red-400">warning red</strong>. Circular imports induce tightly coupled architectures and block bundlers optimizations.
                  </p>
                </div>
                <p>
                  Clicking any cell intersection centers the main workspace graph on the corresponding importer node, facilitating instantaneous navigation.
                </p>
              </div>
            )}

            {activeSection === 'settings' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-text-main">Aesthetics & Customization Settings</h3>
                <p>
                  Access the settings dashboard to adjust your pairing environment:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-text-dim">
                  <li><strong className="text-text-main">Theme Preset & Accent</strong>: Alternate dark/light schemes and custom borders tints (Neon Sapphire, Emerald Aurora, Nebula Purple).</li>
                  <li><strong className="text-text-main">Typography Selection</strong>: Pick Inter, Outfit, Roboto, Fira Code, or Source Code Pro.</li>
                  <li><strong className="text-text-main">Graph Settings</strong>: Toggle grid lines/dots pattern, node sizes scaling, and edge routing curves.</li>
                  <li><strong className="text-text-main">API Parameters</strong>: Control Gemini temperature, system prompts overrides, and keys persistence.</li>
                </ul>
              </div>
            )}

            {activeSection === 'shortcuts' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-text-main">Global Keyboard Shortcuts</h3>
                <p>
                  Accelerate your analysis using built-in keyboard controls. You can map custom bindings inside Settings under Keybindings.
                </p>
                <div className="border border-border-subtle rounded-xl overflow-hidden text-xs">
                  <div className="grid grid-cols-3 bg-surface-raised/60 p-2 border-b border-border-subtle font-bold text-text-main uppercase tracking-wider text-[10px]">
                    <div>Command Action</div>
                    <div>Default Shortcut</div>
                    <div>Scope</div>
                  </div>
                  <div className="divide-y divide-border-subtle font-mono text-[11px]">
                    <div className="grid grid-cols-3 p-2">
                      <div className="text-text-main font-sans">Command Palette</div>
                      <div>Ctrl + K</div>
                      <div className="text-text-dim/80 font-sans">Global</div>
                    </div>
                    <div className="grid grid-cols-3 p-2">
                      <div className="text-text-main font-sans">Open Folder</div>
                      <div>Ctrl + O</div>
                      <div className="text-text-dim/80 font-sans">Global</div>
                    </div>
                    <div className="grid grid-cols-3 p-2">
                      <div className="text-text-main font-sans">Toggle Theme</div>
                      <div>Ctrl + T</div>
                      <div className="text-text-dim/80 font-sans">Workspace</div>
                    </div>
                    <div className="grid grid-cols-3 p-2">
                      <div className="text-text-main font-sans">Toggle Mini Map</div>
                      <div>Ctrl + M</div>
                      <div className="text-text-dim/80 font-sans">Graph Canvas</div>
                    </div>
                    <div className="grid grid-cols-3 p-2">
                      <div className="text-text-main font-sans">2D Hierarchical Layout</div>
                      <div>Alt + 2</div>
                      <div className="text-text-dim/80 font-sans">Graph Canvas</div>
                    </div>
                    <div className="grid grid-cols-3 p-2">
                      <div className="text-text-main font-sans">3D Spatial force-directed</div>
                      <div>Alt + 3</div>
                      <div className="text-text-dim/80 font-sans">Graph Canvas</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer shadow-md shadow-blue-500/10"
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
}
