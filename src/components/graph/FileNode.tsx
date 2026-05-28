import { Handle, Position } from '@xyflow/react';
import { FileCode, FileType, Layout } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}export function FileNode({ data, selected }: any) {
  const isBackend = data.isBackend;

  // Extract a short path, e.g. the last 2 folder names
  const pathParts = data.path ? data.path.split('/') : [];
  const dirPath = pathParts.length > 1
    ? pathParts.slice(Math.max(0, pathParts.length - 3), pathParts.length - 1).join('/')
    : '';

  return (
    <div
      className={cn(
        "bg-slate-900/90 backdrop-blur-md border rounded-xl min-w-[240px] transition-all duration-200 shadow-xl",
        selected
          ? isBackend
            ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500"
            : "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-500"
          : isBackend
            ? "border-emerald-900/50 hover:border-emerald-700"
            : "border-slate-700 hover:border-slate-500"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-slate-500 border-2 border-slate-900 rounded-full !-left-1"
      />
      <div className="p-3">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-slate-800 rounded-lg shrink-0 mt-1">
            {data.type === 'TSX' || data.type === 'JSX' ? (
              <Layout size={14} className="text-blue-400" />
            ) : data.type === 'TS' || data.type === 'JS' ? (
              <FileCode size={14} className="text-yellow-400" />
            ) : (
              <FileType size={14} className="text-slate-400" />
            )}
          </div>
          <div className="flex flex-col overflow-hidden w-full">
            <div className="flex justify-between items-start w-full">
              <div className="flex flex-col">
                {dirPath && (
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[130px] leading-tight">
                    {dirPath}/
                  </span>
                )}
                <span className="font-semibold text-slate-200 text-sm truncate max-w-[130px]">
                  {data.label}
                </span>
              </div>
              
              {data.semantic_group && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap ml-2 mt-1 shrink-0">
                  {data.semantic_group}
                </span>
              )}
            </div>
            
            {data.summary && (
              <p className="text-[10px] text-slate-400 mt-2 leading-snug line-clamp-2 pr-1">
                {data.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-slate-800/50 bg-slate-800/20 rounded-b-xl flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 tracking-wider">
          {data.type}
        </span>
        <span className="text-[10px] font-medium text-slate-400 tracking-wide uppercase">
          {data.semantic_group ? "AI Enriched" : data.subLabel}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-slate-500 border-2 border-slate-900 rounded-full !-right-1"
      />
    </div>
  );
}
