import { Handle, Position } from '@xyflow/react';
import { FileCode, FileType, Layout, Trash2, Layers } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}export function FileNode({ data, selected }: any) {
  const isBackend = data.isBackend;
  const isHorizontal = data.direction !== 'TB';

  // Extract a short path, e.g. the last 2 folder names
  const pathParts = data.path ? data.path.split('/') : [];
  const dirPath = pathParts.length > 1
    ? pathParts.slice(Math.max(0, pathParts.length - 3), pathParts.length - 1).join('/')
    : '';

  return (
    <div
      className={cn(
        "bg-slate-800/90 backdrop-blur-xl border-2 rounded-2xl min-w-[260px] max-w-[320px] transition-all duration-300 shadow-2xl",
        selected
          ? isBackend
            ? "border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400"
            : "border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.4)] ring-2 ring-blue-400"
          : isBackend
            ? "border-emerald-700/60 hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            : "border-slate-600 hover:border-slate-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]"
      )}
    >
      <Handle
        type="target"
        position={isHorizontal ? Position.Left : Position.Top}
        className={cn(
          "w-3 h-3 bg-slate-300 border-2 border-slate-900 rounded-full",
          isHorizontal ? "!-left-[7px]" : "!-top-[7px]"
        )}
      />
      <div className="p-4 relative">
        {data.isDeadCode && (
          <div className="absolute -top-3 -right-3 flex items-center space-x-1 z-10">
            <span className="px-2 py-1 bg-red-900/60 text-red-300 border border-red-500/50 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center backdrop-blur-sm">
              <span className="mr-1">💀</span> Dead Code
            </span>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const confirmed = await confirm(`Are you sure you want to permanently delete ${data.label} from your hard drive?`, {
                  title: 'Delete Dead Code',
                  kind: 'warning'
                });
                if (confirmed) {
                  try {
                    await invoke('delete_file', { path: data.path });
                    if (data.onDelete) data.onDelete();
                  } catch (err) {
                    console.error("Failed to delete", err);
                  }
                }
              }}
              className="p-1.5 bg-slate-800 hover:bg-red-600 text-red-400 hover:text-white rounded-md border border-slate-600 hover:border-red-500 transition-colors cursor-pointer shadow-lg"
              title="Delete File"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-slate-900/80 rounded-xl shrink-0 mt-0.5 ring-1 ring-slate-700">
            {data.type === 'TSX' || data.type === 'JSX' ? (
              <Layout size={18} className="text-blue-400" />
            ) : data.type === 'TS' || data.type === 'JS' ? (
              <FileCode size={18} className="text-yellow-400" />
            ) : (
              <FileType size={18} className="text-slate-400" />
            )}
          </div>
          <div className="flex flex-col overflow-hidden w-full">
            <div className="flex justify-between items-start w-full">
              <div className="flex flex-col">
                {dirPath && (
                  <span className="text-xs text-slate-400 font-mono truncate max-w-[150px] leading-tight mb-1">
                    {dirPath}/
                  </span>
                )}
                <span className="font-bold text-white text-base truncate max-w-[150px] tracking-wide">
                  {data.label}
                </span>
              </div>
              
              {data.semantic_group && (
                <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap ml-2 shrink-0">
                  {data.semantic_group}
                </span>
              )}
            </div>
            
            {data.summary && (
              <p className="text-sm text-slate-300 mt-3 leading-snug line-clamp-2">
                {data.summary}
              </p>
            )}

            {data.layouts && data.layouts.length > 0 && (
              <div className="flex items-center space-x-1.5 mt-3.5 px-2.5 py-1.5 bg-violet-950/45 text-violet-300 border border-violet-800/30 rounded-xl text-[10px] font-semibold tracking-wide w-fit shadow-inner animate-in fade-in slide-in-from-bottom-1 duration-200">
                <Layers size={12} className="text-violet-400 shrink-0" />
                <span className="truncate max-w-[180px]">
                  Wrapped by {data.layouts[data.layouts.length - 1]}
                </span>
              </div>
            )}
          </div>
          {data.semantic_group ? (
            <span className="px-2 py-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300 rounded-md border border-blue-500/30 text-[10px] font-bold flex items-center shadow-[0_0_10px_rgba(59,130,246,0.1)]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse"></span>
              AI Enriched
            </span>
          ) : (
            <span className="px-2 py-1 bg-slate-900 text-slate-400 rounded-md border border-slate-700 text-[10px] font-semibold uppercase tracking-wider">
              {data.subLabel && data.subLabel !== 'File' ? data.subLabel : data.type}
            </span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={isHorizontal ? Position.Right : Position.Bottom}
        className={cn(
          "w-3 h-3 bg-slate-300 border-2 border-slate-900 rounded-full",
          isHorizontal ? "!-right-[7px]" : "!-bottom-[7px]"
        )}
      />
    </div>
  );
}
