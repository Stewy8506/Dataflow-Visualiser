import { useState, useEffect, memo, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';
import { invoke } from '@tauri-apps/api/core';
import { Code2, Loader2 } from 'lucide-react';

interface PreviewNodeProps {
  id: string;
  data: {
    label: string;
    path: string;
    workspacePath: string;
    subLabel?: string;
  };
  selected?: boolean;
}

export const PreviewNode = memo(({ data, selected }: PreviewNodeProps) => {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dependencies, setDependencies] = useState<Record<string, string>>({
    "lucide-react": "latest",
    "framer-motion": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
  });
  const [error, setError] = useState<string | null>(null);

  const nodeRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '400px' }
    );
    if (nodeRef.current) observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;
    
    const handleRenderPreview = async () => {
      setLoading(true);
      setError(null);

    try {
      const workspacePath = data.workspacePath;
      if (!workspacePath) throw new Error("Workspace path not found");

      const nodeId = data.path;
      const packageJsonPath = workspacePath.replace(/\\/g, '/') + '/package.json';
      
      const globalCssPaths = [
        workspacePath.replace(/\\/g, '/') + '/src/app/globals.css',
        workspacePath.replace(/\\/g, '/') + '/src/globals.css',
        workspacePath.replace(/\\/g, '/') + '/src/index.css',
        workspacePath.replace(/\\/g, '/') + '/styles/globals.css',
      ];
      const allPaths = Array.from(new Set([nodeId, ...globalCssPaths]));
      
      const fileData: Record<string, string> = {};
      const normalizedWorkspace = workspacePath.replace(/\\/g, '/');
      const fetchQueue = new Set<string>();
      const fetchedPaths = new Set<string>();

      const addFileToQueue = (filePath: string) => {
         const p = filePath.replace(/\\/g, '/');
         if (!fetchedPaths.has(p) && p.toLowerCase().startsWith(normalizedWorkspace.toLowerCase())) {
           fetchQueue.add(p);
         }
      };

      allPaths.forEach(p => addFileToQueue(p));

      const resolveImport = (importStr: string, currentPath: string) => {
         if (importStr.startsWith('@/') || importStr.startsWith('~/')) {
           return normalizedWorkspace + '/src/' + importStr.substring(2);
         }
         if (importStr.startsWith('.')) {
           const parts = currentPath.split('/');
           parts.pop();
           const importParts = importStr.split('/');
           for (const p of importParts) {
             if (p === '.') continue;
             if (p === '..') parts.pop();
             else parts.push(p);
           }
           return parts.join('/');
         }
         return null;
      };

      const tryRead = async (pathToCheck: string): Promise<{content: string, finalPath: string} | null> => {
         try {
           const content = await invoke<string>('read_file_content', { path: pathToCheck });
           return { content, finalPath: pathToCheck };
         } catch {
           return null;
         }
      };

      const fetchAll = async () => {
         const maxIterations = 20;
         let iterations = 0;
         while (fetchQueue.size > 0 && iterations++ < maxIterations) {
           const currentBatch = Array.from(fetchQueue);
           fetchQueue.clear();

           await Promise.all(currentBatch.map(async (p) => {
             fetchedPaths.add(p);
             if (p.startsWith('ext:')) return;
             
             let result = await tryRead(p);
             if (!result && !p.match(/\.(ts|tsx|js|jsx|css|json|md)$/i)) {
               result = await tryRead(p + '.ts') || await tryRead(p + '.tsx') || await tryRead(p + '.js') || await tryRead(p + '.jsx') || await tryRead(p + '/index.ts') || await tryRead(p + '/index.tsx');
             }

             if (result) {
               let relativePath = result.finalPath.slice(normalizedWorkspace.length);
               if (!relativePath.startsWith('/')) relativePath = '/' + relativePath;
               
               let safeContent = result.content;
               
               // Strip unsupported next.js modules
               if (safeContent.includes('next/font')) {
                 safeContent = safeContent.replace(/import\s+.*?from\s+['"]next\/font\/.*?['"];?/g, '// [stripped next/font import]');
               }

               // Rewrite @/ and ~/ to relative paths so CodeSandbox can resolve them
               if (relativePath.match(/\.(ts|tsx|js|jsx)$/i)) {
                  const depth = Math.max(0, relativePath.split('/').length - 2);
                  const up = depth > 0 ? '../'.repeat(depth) : './';
                  
                  safeContent = safeContent.replace(/(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([@~]\/)(.*?)['"]/g, (match, prefix, rest) => {
                     return match.replace(prefix, up + 'src/'); 
                  });

                  // Mock Next.js routing
                  safeContent = safeContent.replace(/from\s+['"]next\/(link|navigation|image|script)['"]/g, (match, type) => {
                     return `from '${up}mocks/next-${type}'`;
                  });
               }

               fileData[relativePath] = safeContent;
               
               if (relativePath.match(/\.(ts|tsx|js|jsx)$/i)) {
                  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"](.*?)['"]/g;
                  let match;
                  while ((match = importRegex.exec(result.content)) !== null) {
                     const importStr = match[1];
                     const resolved = resolveImport(importStr, result.finalPath);
                     if (resolved && !fetchedPaths.has(resolved)) {
                       addFileToQueue(resolved);
                     }
                  }
               }
             }
           }));
         }
      };

      await fetchAll();

      const normalizedSelected = nodeId.replace(/\\/g, '/');
      let selectedRelative = normalizedSelected;
      if (normalizedSelected.toLowerCase().startsWith(normalizedWorkspace.toLowerCase())) {
        selectedRelative = normalizedSelected.slice(normalizedWorkspace.length);
      }
      if (!selectedRelative.startsWith('/')) {
        selectedRelative = '/' + selectedRelative;
      }

      const mainContent = fileData[selectedRelative] || '';
      const hasDefaultExport = mainContent.includes('export default');
      
      let componentName = 'Component';
      if (!hasDefaultExport) {
        const match = mainContent.match(/export (?:const|function|class) ([A-Z][a-zA-Z0-9_]*)/);
        if (match && match[1]) {
          componentName = match[1];
        }
      }

      const importPath = selectedRelative.replace(/\.tsx?$/, '').replace(/\.jsx?$/, '');
      const foundCssFile = Object.keys(fileData).find(p => p.endsWith('.css'));
      
      const entryFile = '/App.tsx';
      
      fileData[entryFile] = `
import React from 'react';
${foundCssFile ? `import '.${foundCssFile}';` : ''}
${hasDefaultExport ? `import Component from '.${importPath}';` : `import { ${componentName} as Component } from '.${importPath}';`}

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <Component />
    </div>
  );
}
      `;

      fileData['/mocks/next-navigation.ts'] = `
export const useRouter = () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} });
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();
export const notFound = () => {};
      `;
      fileData['/mocks/next-link.tsx'] = `
import React from 'react';
export default function Link({ children, href, ...props }: any) {
  return <a href={href} {...props}>{children}</a>;
}
      `;
      fileData['/mocks/next-image.tsx'] = `
import React from 'react';
export default function Image({ src, alt, ...props }: any) {
  return <img src={src} alt={alt} {...props} />;
}
      `;
      fileData['/mocks/next-script.tsx'] = `
import React from 'react';
export default function Script({ children, ...props }: any) {
  return <script {...props}>{children}</script>;
}
      `;

      if (isMounted) {
        setFiles(fileData);
        setLoading(false);
      }
    } catch (err: any) {
      if (isMounted) {
        setError(err.toString());
        setLoading(false);
      }
    }
  };

    handleRenderPreview();
    
    return () => { isMounted = false; };
  }, [data.workspacePath, data.path, isVisible]);

  return (
    <div 
      ref={nodeRef}
      className={`relative transition-all duration-300 ease-out border rounded-2xl overflow-hidden
        ${selected ? 'border-indigo-400 ring-2 ring-indigo-400/30 shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'border-slate-700/50 hover:border-slate-600 shadow-xl'}
      `}
      style={{
        width: 400,
        height: 300,
        zIndex: selected ? 100 : 1,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-slate-900" />
      
      {/* Node Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900/40 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-5 h-5 rounded-md bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Code2 size={12} className="text-indigo-400" />
          </div>
          <span className="text-xs font-medium text-slate-200 truncate tracking-wide" title={data.label}>
            {data.label}
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative w-full" style={{ height: 'calc(100% - 37px)' }}>
        {!isVisible ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-text-dim">
            <span className="text-xs font-medium">Out of View</span>
          </div>
        ) : loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-text-dim">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary mb-3" />
            <span className="text-xs font-medium">Resolving Dependencies & Building...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 p-4 overflow-auto bg-background text-rose-400 text-xs font-mono">
            Error: {error}
          </div>
        ) : (
          <div className="w-full h-full pointer-events-auto bg-slate-900" onWheelCapture={(e) => e.stopPropagation()}>
            <SandpackProvider 
              template="react-ts"
              theme="dark"
              files={files}
              customSetup={{ dependencies }}
              options={{
                activeFile: '/App.tsx',
                externalResources: ["https://cdn.tailwindcss.com"],
                classes: {
                  "sp-wrapper": "h-full w-full",
                  "sp-layout": "h-full w-full",
                  "sp-preview": "h-full w-full",
                  "sp-preview-container": "h-full w-full",
                }
              }}
            >
              <SandpackPreview 
                showNavigator={false} 
                showOpenInCodeSandbox={false}
                showRefreshButton={false}
                className="h-full w-full border-none" 
              />
            </SandpackProvider>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-border-strong !border-none" />
    </div>
  );
});

PreviewNode.displayName = 'PreviewNode';
