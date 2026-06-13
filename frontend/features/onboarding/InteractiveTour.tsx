import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { load } from '@tauri-apps/plugin-store';

export function InteractiveTour() {
  useEffect(() => {
    let cancelled = false;

    load('settings.json', { autoSave: true, defaults: {} }).then(async store => {
      const hasSeenTour = await store.get<boolean>('codemapper-tour-seen');
      if (cancelled || hasSeenTour) return;

      const tourDriver = driver({
        showProgress: true,
        steps: [
          {
            element: '.sidebar-container',
            popover: { title: 'Navigation', description: 'Access AI chat, snapshots, and source control here.', side: 'right' }
          },
          {
            element: '.view-toggle-btn',
            popover: { title: '2D and 3D Views', description: 'Switch between the precise dependency layout and spatial graph view.', side: 'bottom' }
          },
          {
            element: '.command-palette-btn',
            popover: { title: 'Command Palette', description: 'Press Ctrl+K to jump to commands or files.', side: 'bottom' }
          }
        ],
        onDestroyed: () => {
          void store.set('codemapper-tour-seen', true).then(() => store.save());
        }
      });

      setTimeout(() => {
        if (!cancelled && (document.querySelector('.sidebar-container') || document.querySelector('.view-toggle-btn'))) {
          tourDriver.drive();
        }
      }, 1500);
    });

    return () => { cancelled = true; };
  }, []);

  return null;
}
