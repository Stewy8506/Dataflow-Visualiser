import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FolderOpen, Settings, Sun, Moon, Box, Spline,
  Map, Layers, Server, Layout, Command
} from 'lucide-react';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeDirectory: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onSetViewMode: (mode: '2d' | '3d') => void;
  onToggleMiniMap: () => void;
  onSetLayer: (layer: 'ui' | 'backend' | 'overall') => void;
  isLightMode: boolean;
  viewMode: '2d' | '3d';
  showMiniMap: boolean;
  nodes: any[];
  onSelectNode: (node: any) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onChangeDirectory,
  onToggleTheme,
  onOpenSettings,
  onSetViewMode,
  onToggleMiniMap,
  onSetLayer,
  isLightMode,
  viewMode,
  showMiniMap,
  nodes,
  onSelectNode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions: CommandAction[] = useMemo(() => [
    {
      id: 'change-dir',
      label: 'Change Project Directory',
      description: 'Open a different project folder',
      icon: <FolderOpen size={16} />,
      action: () => { onChangeDirectory(); onClose(); },
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'API keys, model selection, IDE preference',
      icon: <Settings size={16} />,
      action: () => { onOpenSettings(); onClose(); },
    },
    {
      id: 'toggle-theme',
      label: isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      description: 'Toggle between dark and light themes',
      icon: isLightMode ? <Moon size={16} /> : <Sun size={16} />,
      action: () => { onToggleTheme(); onClose(); },
    },
    {
      id: 'view-2d',
      label: 'Switch to 2D Flow View',
      description: 'Hierarchical DAG layout',
      icon: <Spline size={16} />,
      action: () => { onSetViewMode('2d'); onClose(); },
    },
    {
      id: 'view-3d',
      label: 'Switch to 3D Graph View',
      description: 'Force-directed 3D layout',
      icon: <Box size={16} />,
      action: () => { onSetViewMode('3d'); onClose(); },
    },
    {
      id: 'toggle-minimap',
      label: showMiniMap ? 'Hide Mini Map' : 'Show Mini Map',
      description: 'Toggle the mini map overlay',
      icon: <Map size={16} />,
      action: () => { onToggleMiniMap(); onClose(); },
    },
    {
      id: 'layer-overall',
      label: 'Show All Layers',
      description: 'Display both UI and backend nodes',
      icon: <Layers size={16} />,
      action: () => { onSetLayer('overall'); onClose(); },
    },
    {
      id: 'layer-ui',
      label: 'Show UI Layer Only',
      description: 'Filter to frontend components',
      icon: <Layout size={16} />,
      action: () => { onSetLayer('ui'); onClose(); },
    },
    {
      id: 'layer-backend',
      label: 'Show Backend Layer Only',
      description: 'Filter to backend services and APIs',
      icon: <Server size={16} />,
      action: () => { onSetLayer('backend'); onClose(); },
    },
  ], [isLightMode, showMiniMap, viewMode, onChangeDirectory, onClose, onOpenSettings, onToggleTheme, onSetViewMode, onToggleMiniMap, onSetLayer]);

  const fileNodes = useMemo(() => nodes.filter(n => n.data && !n.data.isExternal), [nodes]);

  const fileActions: CommandAction[] = useMemo(() => {
    return fileNodes.map(node => ({
      id: `file-${node.id}`,
      label: `Jump to ${node.data?.label || node.id}`,
      description: node.id,
      icon: <Spline size={16} className="text-emerald-400" />,
      action: () => {
        onSelectNode(node);
        onClose();
      }
    }));
  }, [fileNodes, onSelectNode, onClose]);

  const allActions = useMemo(() => {
    return [...actions, ...fileActions];
  }, [actions, fileActions]);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return allActions.filter(a =>
      a.label.toLowerCase().includes(q) ||
      (a.description && a.description.toLowerCase().includes(q))
    );
  }, [query, actions, allActions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center pt-[15vh] nebula-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 nebula-slide-up"
        onKeyDown={handleKeyDown}
      >
        <div className="bg-surface border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
            <Command size={16} className="text-text-dim shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type a command..."
              className="flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-dim/50"
            />
            <kbd className="px-1.5 py-0.5 bg-surface-raised border border-border rounded text-[10px] text-text-dim font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-text-dim">
                No commands found
              </div>
            ) : (
              filtered.map((action, i) => (
                <button
                  key={action.id}
                  onClick={action.action}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer ${
                    i === selectedIndex
                      ? 'bg-surface-raised text-text-main'
                      : 'text-text-muted hover:bg-surface-raised/50'
                  }`}
                >
                  <div className={`shrink-0 ${i === selectedIndex ? 'text-blue-400' : 'text-text-dim'}`}>
                    {action.icon}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{action.label}</span>
                    {action.description && (
                      <span className="text-[11px] text-text-dim truncate">{action.description}</span>
                    )}
                  </div>
                  {action.shortcut && (
                    <kbd className="px-1.5 py-0.5 bg-surface border border-border-subtle rounded text-[10px] text-text-dim font-mono shrink-0">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-5 py-2.5 border-t border-border-subtle text-[10px] text-text-dim">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-surface-raised border border-border-subtle rounded font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-surface-raised border border-border-subtle rounded font-mono">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-surface-raised border border-border-subtle rounded font-mono">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
