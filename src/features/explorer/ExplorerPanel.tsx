import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileCode, FileType, Layout, Cpu, FolderOpen } from 'lucide-react';

interface ExplorerPanelProps {
  nodes: { id: string; data: { label: string; group: string; isBackend: boolean; isDeadCode: boolean } }[];
  onNodeFocus: (nodeId: string) => void;
  selectedNodeId: string | null;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFile: boolean;
  children: TreeNode[];
  fileData?: { group: string; isBackend: boolean; isDeadCode: boolean };
}

function buildTree(nodes: ExplorerPanelProps['nodes']): TreeNode {
  const root: TreeNode = { name: 'root', fullPath: '', isFile: false, children: [] };

  for (const node of nodes) {
    const parts = node.id.replace(/\\/g, '/').split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part,
          fullPath: parts.slice(0, i + 1).join('/'),
          isFile: isLast,
          children: [],
          fileData: isLast ? { group: node.data.group, isBackend: node.data.isBackend, isDeadCode: node.data.isDeadCode } : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort: folders first, then files, alphabetically
  function sortTree(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  }
  sortTree(root);

  // Collapse single-child folders
  function collapse(node: TreeNode): TreeNode {
    if (!node.isFile && node.children.length === 1 && !node.children[0].isFile) {
      const child = node.children[0];
      return collapse({
        ...child,
        name: `${node.name}/${child.name}`,
        children: child.children,
      });
    }
    return { ...node, children: node.children.map(collapse) };
  }

  return { ...root, children: root.children.map(collapse) };
}

function getFileIcon(group: string, isBackend: boolean) {
  if (isBackend) return <Cpu size={13} className="text-emerald-400" />;
  if (['tsx', 'jsx', 'vue', 'svelte', 'dart'].includes(group)) return <Layout size={13} className="text-blue-400" />;
  if (['ts', 'js', 'py', 'rs'].includes(group)) return <FileCode size={13} className="text-amber-400" />;
  return <FileType size={13} className="text-text-dim" />;
}

function TreeItem({
  node,
  depth,
  onNodeFocus,
  selectedNodeId,
}: {
  node: TreeNode;
  depth: number;
  onNodeFocus: (nodeId: string) => void;
  selectedNodeId: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.isFile) {
    const isSelected = selectedNodeId && node.fullPath && selectedNodeId.replace(/\\/g, '/').endsWith(node.fullPath);

    return (
      <button
        onClick={() => onNodeFocus(node.fullPath)}
        className={`w-full flex items-center gap-2 py-1 pr-2 rounded-md text-left transition-colors cursor-pointer ${
          isSelected
            ? 'bg-blue-500/10 text-text-main'
            : 'text-text-muted hover:bg-surface-raised hover:text-text-main'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        title={node.fullPath}
      >
        {node.fileData && getFileIcon(node.fileData.group, node.fileData.isBackend)}
        <span className="text-[11px] truncate flex-1">{node.name}</span>
        {node.fileData?.isDeadCode && (
          <span className="text-[8px] text-red-400 font-bold shrink-0">💀</span>
        )}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 py-1 pr-2 rounded-md text-left text-text-dim hover:text-text-main hover:bg-surface-raised transition-colors cursor-pointer"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <FolderOpen size={13} className="text-text-dim" />
        <span className="text-[11px] font-medium truncate">{node.name}</span>
        <span className="text-[9px] text-text-dim/60 ml-auto shrink-0">{node.children.length}</span>
      </button>
      {expanded && (
        <div>
          {node.children.map(child => (
            <TreeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              onNodeFocus={onNodeFocus}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExplorerPanel({ nodes, onNodeFocus, selectedNodeId }: ExplorerPanelProps) {
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  return (
    <div className="w-64 h-full bg-surface border-r border-border flex flex-col text-sm animate-panel-slide-in relative z-20">
      <div className="p-3 border-b border-border font-semibold text-text-main flex items-center gap-2 flex-shrink-0">
        <FolderOpen size={16} className="text-text-dim" />
        Explorer
        <span className="ml-auto text-[10px] text-text-dim font-mono">{nodes.length} files</span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {tree.children.length === 0 ? (
          <div className="p-4 text-xs text-text-dim italic">No files loaded.</div>
        ) : (
          tree.children.map(child => (
            <TreeItem
              key={child.fullPath}
              node={child}
              depth={0}
              onNodeFocus={onNodeFocus}
              selectedNodeId={selectedNodeId}
            />
          ))
        )}
      </div>
    </div>
  );
}
