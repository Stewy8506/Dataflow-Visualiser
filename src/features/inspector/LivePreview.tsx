import { useState, useEffect } from 'react';
import { Sandpack } from '@codesandbox/sandpack-react';
import { invoke } from '@tauri-apps/api/core';

interface LivePreviewProps {
  selectedNode: any;
  workspacePath: string | null;
  edges: any[];
}

export function LivePreview({ selectedNode, workspacePath, edges }: LivePreviewProps) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [debugPaths, setDebugPaths] = useState<string[]>([]);
  const [dependencies, setDependencies] = useState<Record<string, string>>({
    "lucide-react": "latest",
    "framer-motion": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNode || !workspacePath) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadFiles = async () => {
      try {
        const nodeId = selectedNode.id;
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

        // Dynamically extract dependencies from package.json without passing it into the sandbox files
        let pkgDependencies: Record<string, string> = {
          "lucide-react": "latest",
          "framer-motion": "latest",
          "clsx": "latest",
          "tailwind-merge": "latest",
        };
        try {
          const pkgContent = await invoke<string>('read_file_content', { path: packageJsonPath });
          const pkg = JSON.parse(pkgContent);
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          for (const [name, version] of Object.entries(allDeps)) {
            if (!['next', 'eslint', 'typescript', 'tailwindcss', 'postcss', 'eslint-config-next'].includes(name) && !name.startsWith('@types/')) {
              pkgDependencies[name] = version as string;
            }
          }
        } catch (e) {
          console.warn("Failed to read package.json for dependencies");
        }
        setDependencies(pkgDependencies);

        // --- Recursive Client-Side Dependency Resolver ---
        const fetchQueue = new Set<string>();
        const fetchedPaths = new Set<string>();
        const allLoadedPaths: string[] = [];

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
             parts.pop(); // remove filename
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
                 allLoadedPaths.push(result.finalPath);
                 let relativePath = result.finalPath.slice(normalizedWorkspace.length);
                 if (!relativePath.startsWith('/')) relativePath = '/' + relativePath;
                 
                 let safeContent = result.content;
                 if (safeContent.includes('next/font')) {
                   safeContent = safeContent.replace(/import\s+.*?from\s+['"]next\/font\/.*?['"];?/g, '// [stripped next/font import]');
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
        setDebugPaths(allLoadedPaths);

        if (!isMounted) return;

        // Sandpack requires an entry point like App.tsx.
        // We will create a wrapper index.tsx that mounts the selected component.
        const normalizedSelected = nodeId.replace(/\\/g, '/');
        let selectedRelative = normalizedSelected;
        if (normalizedSelected.toLowerCase().startsWith(normalizedWorkspace.toLowerCase())) {
          selectedRelative = normalizedSelected.slice(normalizedWorkspace.length);
        }
        if (!selectedRelative.startsWith('/')) {
          selectedRelative = '/' + selectedRelative;
        }

        // To import the selected component, we need its exported name.
        // For simplicity, if it's a default export, we import it as Component.
        // If it's a named export, we might fail unless we parse it.
        // Best effort: we just render the file itself as the main file, but Sandpack react-ts template expects App.tsx.
        // So we can map the selected file to App.tsx? No, it has its own relative imports.
        // Instead, we create an App.tsx that imports from selectedRelative.
        
        // We can inspect the file content to see if it has a default export.
        const mainContent = fileData[selectedRelative] || '';
        const hasDefaultExport = mainContent.includes('export default');
        
        // Extract component name from export if not default
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

        // Mock Next.js routing and components to prevent WebContainer crashes
        fileData['/mocks/next-navigation.ts'] = `
export const useRouter = () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} });
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();
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

        fileData['/tsconfig.json'] = JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["./src/*", "./*"],
              "~/*": ["./src/*", "./*"],
              "next/navigation": ["./mocks/next-navigation.ts"],
              "next/router": ["./mocks/next-navigation.ts"],
              "next/link": ["./mocks/next-link.tsx"],
              "next/image": ["./mocks/next-image.tsx"]
            }
          }
        }, null, 2);

        setFiles(fileData);
      } catch (err: any) {
        if (isMounted) setError(err.toString());
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFiles();

    return () => { isMounted = false; };
  }, [selectedNode, workspacePath, edges]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-text-dim">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-surface-raised border-t-blue-500 rounded-full animate-spin mb-4" />
          <span className="text-xs">Preparing Sandbox...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4 bg-background text-rose-400 font-mono text-xs overflow-y-auto">
        <div className="mb-4">Error loading preview: {error}</div>
        <div className="text-text-muted mt-4">Loaded Paths:</div>
        <ul className="list-disc pl-4 mt-2">
          {debugPaths.map(p => <li key={p}>{p}</li>)}
        </ul>
      </div>
    );
  }

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-text-dim text-xs">
        No preview available.
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full bg-background overflow-hidden relative">
      <Sandpack 
        template="react-ts"
        theme="dark"
        files={files}
        options={{
          showNavigator: false,
          showTabs: true,
          closableTabs: true,
          editorHeight: '100%',
          activeFile: '/App.tsx',
          externalResources: ["https://cdn.tailwindcss.com"],
          classes: {
            "sp-wrapper": "h-full w-full",
            "sp-layout": "h-full w-full",
          }
        }}
        customSetup={{
          dependencies: dependencies
        }}
      />
      
      <div className="absolute bottom-0 left-0 w-full p-2 bg-black/80 text-white text-[10px] h-32 overflow-y-auto pointer-events-none z-50">
        <div>Loaded Files:</div>
        {debugPaths.map(p => <div key={p}>{p}</div>)}
      </div>
    </div>
  );
}
