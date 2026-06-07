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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNode || !workspacePath) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadFiles = async () => {
      try {
        const nodeId = selectedNode.id;
        // Find dependencies (depth 1)
        const deps = edges
          .filter(e => e.data?.originalSource === nodeId)
          .map(e => e.data?.originalTarget)
          .filter(Boolean) as string[];
        
        // Find dependencies of dependencies (depth 2)
        const depsDepth2 = edges
          .filter(e => deps.includes(e.data?.originalSource))
          .map(e => e.data?.originalTarget)
          .filter(Boolean) as string[];

        const packageJsonPath = workspacePath.replace(/\\/g, '/') + '/package.json';
        const globalCssPaths = [
          workspacePath.replace(/\\/g, '/') + '/src/app/globals.css',
          workspacePath.replace(/\\/g, '/') + '/src/globals.css',
          workspacePath.replace(/\\/g, '/') + '/src/index.css',
          workspacePath.replace(/\\/g, '/') + '/styles/globals.css',
        ];
        const allPaths = Array.from(new Set([nodeId, packageJsonPath, ...globalCssPaths, ...deps, ...depsDepth2]));
        
        const fileData: Record<string, string> = {};
        const normalizedWorkspace = workspacePath.replace(/\\/g, '/');

        // Parallel fetch
        await Promise.all(allPaths.map(async (p) => {
          if (p.startsWith('ext:')) return; // skip external dependencies
          try {
            const content = await invoke<string>('read_file_content', { path: p });
            const normalizedPath = p.replace(/\\/g, '/');
            let relativePath = normalizedPath;
            if (normalizedPath.startsWith(normalizedWorkspace)) {
              relativePath = normalizedPath.slice(normalizedWorkspace.length);
            }
            if (!relativePath.startsWith('/')) {
              relativePath = '/' + relativePath;
            }
            fileData[relativePath] = content;
          } catch (e) {
            console.warn(`Failed to read file for preview: ${p}`, e);
          }
        }));

        if (!isMounted) return;

        // Sandpack requires an entry point like App.tsx.
        // We will create a wrapper index.tsx that mounts the selected component.
        const normalizedSelected = nodeId.replace(/\\/g, '/');
        let selectedRelative = normalizedSelected;
        if (normalizedSelected.startsWith(normalizedWorkspace)) {
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
        
        fileData['/App.tsx'] = `
import React from 'react';
${foundCssFile ? `import '${foundCssFile}';` : ''}
${hasDefaultExport ? `import Component from '.${importPath}';` : `import { ${componentName} as Component } from '.${importPath}';`}

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <Component />
    </div>
  );
}
        `;

        fileData['/tsconfig.json'] = JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["./src/*", "./*"],
              "~/*": ["./src/*", "./*"]
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
        Error loading preview: {error}
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
          dependencies: {
            "lucide-react": "^0.292.0",
            "framer-motion": "^10.16.4",
            "clsx": "^2.0.0",
            "tailwind-merge": "^2.0.0",
          }
        }}
      />
    </div>
  );
}
