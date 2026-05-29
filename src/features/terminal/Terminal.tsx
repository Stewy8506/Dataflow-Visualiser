import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  shell: string;
  workspacePath: string | null;
}

export function Terminal({ shell, workspacePath }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // Initialize xterm
    const xterm = new XTerm({
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#4ade80'
      }
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    
    xterm.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    let unlisten: UnlistenFn | undefined;

    const setupTerminal = async () => {
      try {
        // Spawn PTY on backend
        await invoke('spawn_pty', { shell, workspacePath });
        
        // Tell backend about initial size
        await invoke('resize_pty', { 
          rows: xterm.rows, 
          cols: xterm.cols 
        });

        // Handle user input to backend
        xterm.onData((data) => {
          invoke('write_pty', { data });
        });

        // Handle backend output to terminal
        unlisten = await listen<number[]>('pty-data', (event) => {
          const u8Array = new Uint8Array(event.payload);
          xterm.write(u8Array);
        });
      } catch (e) {
        console.error("Failed to setup terminal:", e);
        xterm.write(`\r\n\x1b[31mFailed to start terminal: ${e}\x1b[0m\r\n`);
      }
    };
    
    setupTerminal();
    
    const handleResize = () => {
      try {
        fitAddon.fit();
        invoke('resize_pty', { 
          rows: xterm.rows, 
          cols: xterm.cols 
        });
      } catch (e) {
        console.error("Resize error", e);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Create a ResizeObserver for the container as well
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (unlisten) unlisten();
      xterm.dispose();
    };
  }, [shell]);

  return (
    <div className="w-full h-full p-2 bg-[#0a0a0a]" ref={terminalRef} />
  );
}
