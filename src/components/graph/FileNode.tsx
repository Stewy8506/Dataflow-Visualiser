import { Handle, Position } from '@xyflow/react';
import { FileCode, FileType, Code2, Database, Layout } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getIconForGroup(group: string) {
  switch (group) {
    case 'tsx':
    case 'jsx':
      return <Layout size={14} className="text-blue-400" />;
    case 'ts':
    case 'js':
      return <FileCode size={14} className="text-yellow-400" />;
    case 'css':
      return <FileType size={14} className="text-sky-400" />;
    case 'json':
      return <Database size={14} className="text-green-400" />;
    default:
      return <Code2 size={14} className="text-slate-400" />;
  }
}

export function FileNode({ data, selected }: any) {
  return (
    <div
      className={cn(
        "bg-slate-900/90 backdrop-blur-md border rounded-xl min-w-[220px] transition-all duration-200 shadow-xl",
        selected
          ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-500"
          : "border-slate-700 hover:border-slate-500"
      )}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2 h-2 bg-slate-500 border-2 border-slate-900 rounded-full" 
      />
      
      <div className="p-3">
        <div className="flex items-center space-x-2 mb-2">
          {getIconForGroup(data.group || '')}
          <span className="font-semibold text-slate-100 text-sm truncate">
            {data.label}
          </span>
        </div>
        
        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider mt-4">
          <span className="text-slate-500">{data.type || 'File'}</span>
          <span className="text-slate-400">{data.subLabel || 'Component'}</span>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2 h-2 bg-slate-500 border-2 border-slate-900 rounded-full" 
      />
    </div>
  );
}
