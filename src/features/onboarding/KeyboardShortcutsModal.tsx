import { useEffect, useState } from 'react';
import { X, Command, Search, Layers, Box, Maximize, Play, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on '?' or 'Ctrl+/'
      if (e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        // Prevent typing '?' in inputs
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const shortcuts = [
    { icon: <Command size={16} />, label: 'Command Palette', keys: ['Ctrl', 'K'] },
    { icon: <Search size={16} />, label: 'Search Graph', keys: ['Ctrl', 'F'] },
    { icon: <Layers size={16} />, label: 'Toggle 2D/3D View', keys: ['Alt', 'V'] },
    { icon: <Settings size={16} />, label: 'Open Settings', keys: ['Ctrl', ','] },
    { icon: <Play size={16} />, label: 'AI Chat', keys: ['Ctrl', 'J'] },
    { icon: <Maximize size={16} />, label: 'Fullscreen', keys: ['F11'] },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-surface-raised border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-main">Keyboard Shortcuts</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-dim hover:text-text-main hover:bg-surface transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto">
            <div className="grid gap-3">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                  <div className="flex items-center gap-3 text-text-main">
                    <div className="text-text-dim">{s.icon}</div>
                    <span className="font-medium text-sm">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.keys.map((k, j) => (
                      <kbd key={j} className="px-2 py-1 rounded bg-background border border-border font-mono text-xs text-text-muted shadow-sm">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 border-t border-border bg-surface/50">
            <p className="text-xs text-text-dim text-center">
              Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border mx-1">?</kbd> anytime to open this menu
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
