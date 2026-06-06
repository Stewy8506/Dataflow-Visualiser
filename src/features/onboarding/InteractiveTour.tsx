import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function InteractiveTour() {
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('codemapper-tour-seen');
    if (hasSeenTour) return;

    const tourDriver = driver({
      showProgress: true,
      steps: [
        {
          element: '.sidebar-container', 
          popover: { title: 'Navigation', description: 'Access AI chat, snapshots, and source control here.', side: 'right' }
        },
        {
          element: '.view-toggle-btn',
          popover: { title: '3D/2D View', description: 'Toggle between the stunning 3D force-directed graph and the precise 2D layout.', side: 'bottom' }
        },
        {
          element: '.command-palette-btn',
          popover: { title: 'Command Palette', description: 'Press Ctrl+K to quickly jump anywhere in your codebase.', side: 'bottom' }
        }
      ],
      onDestroyed: () => {
        localStorage.setItem('codemapper-tour-seen', 'true');
      }
    });

    // Short delay to let UI render
    setTimeout(() => {
      // Check if any element exists, otherwise don't run
      if (document.querySelector('.sidebar-container') || document.querySelector('.view-toggle-btn')) {
        tourDriver.drive();
      }
    }, 1500);

  }, []);

  return null;
}
