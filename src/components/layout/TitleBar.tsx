import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

type MenuItem = {
  label?: string;
  action?: string;
  separator?: boolean;
};

const MENU_DEF: Record<string, MenuItem[]> = {
  File: [
    { label: 'Open Folder...', action: 'OPEN_FOLDER' },
    { separator: true },
    { label: 'Settings', action: 'OPEN_SETTINGS' },
    { separator: true },
    { label: 'Exit', action: 'EXIT' },
  ],
  Edit: [
    { label: 'Undo' },
    { label: 'Redo' },
    { separator: true },
    { label: 'Cut' },
    { label: 'Copy' },
    { label: 'Paste' },
  ],
  Selection: [
    { label: 'Select All' },
  ],
  View: [
    { label: 'Command Palette...', action: 'OPEN_COMMAND_PALETTE' },
    { separator: true },
    { label: 'Toggle 2D / 3D Mode', action: 'TOGGLE_VIEW_MODE' },
    { label: 'Toggle Minimap', action: 'TOGGLE_MINIMAP' },
    { label: 'Toggle External Dependencies', action: 'TOGGLE_EXTERNAL_DEPS' },
    { label: 'Toggle Git Churn Heatmap', action: 'TOGGLE_HEATMAP' },
    { label: 'Toggle Snapshots', action: 'TOGGLE_SNAPSHOTS' },
    { separator: true },
    { label: 'Toggle Theme', action: 'TOGGLE_THEME' },
  ],
  Go: [
    { label: 'Go to File...' },
  ],
  Run: [
    { label: 'Reload Window', action: 'RELOAD_WINDOW' },
  ],
  Terminal: [
    { label: 'New Terminal' },
  ],
  Help: [
    { label: 'Documentation', action: 'OPEN_DOCS' },
    { label: 'Support & Diagnostics', action: 'OPEN_SUPPORT' },
    { label: 'About Dataflow Visualiser', action: 'OPEN_SUPPORT' },
  ]
};

const MENUS = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'];

export function TitleBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Click outside to close menu
  useEffect(() => {
    if (!activeMenu) return;
    const handleClick = () => setActiveMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [activeMenu]);

  const handleMenuClick = (e: React.MouseEvent, menu: string) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuHover = (menu: string) => {
    if (activeMenu && activeMenu !== menu) {
      setActiveMenu(menu);
    }
  };

  const handleItemClick = async (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setActiveMenu(null);
    if (item.action) {
      window.dispatchEvent(new CustomEvent('app:action', { detail: item.action }));
    } else {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(`${item.label} has no action attached yet.`, { title: 'No Action', kind: 'info' });
    }
  };

  return (
    <div className="h-8 bg-surface border-b border-border flex items-center justify-between select-none z-50 flex-shrink-0 relative">
      {/* Left side: Icon and Menus */}
      <div className="flex items-center h-full">
        <div data-tauri-drag-region className="flex items-center justify-center w-10 h-full text-blue-400">
          <Sparkles size={14} className="pointer-events-none" />
        </div>

        <div className="flex items-center h-full text-[13px] text-text-dim">
          {MENUS.map(menu => (
            <div
              key={menu}
              className={`relative h-full px-2.5 flex items-center transition-colors ${activeMenu === menu ? 'bg-surface-raised text-text-main' : 'hover:bg-surface-raised hover:text-text-main cursor-default'}`}
              onClick={(e) => handleMenuClick(e, menu)}
              onMouseEnter={() => handleMenuHover(menu)}
            >
              {menu}

              {/* Dropdown Menu */}
              {activeMenu === menu && (
                <div
                  className="absolute top-full left-0 mt-0 min-w-[200px] py-1 bg-surface-raised border border-border rounded-b-md shadow-xl flex flex-col z-[100]"
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                >
                  {(MENU_DEF[menu] || []).map((item, idx) => {
                    if (item.separator) {
                      return <div key={`sep-${idx}`} className="h-px bg-border my-1 mx-2" />;
                    }
                    return (
                      <div
                        key={item.label}
                        className="px-4 py-1.5 text-xs text-text-dim hover:bg-blue-500 hover:text-white cursor-default flex items-center justify-between group transition-colors"
                        onClick={(e) => handleItemClick(e, item)}
                      >
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                  {(!MENU_DEF[menu] || MENU_DEF[menu].length === 0) && (
                    <div className="px-4 py-1.5 text-xs text-text-muted italic">Empty</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Middle: Title */}
      <div data-tauri-drag-region className="flex-1 h-full flex items-center justify-center text-xs text-text-dim/50 font-medium tracking-wide">
        Dataflow Visualiser
      </div>

    </div>
  );
}
