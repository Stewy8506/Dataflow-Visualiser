import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileCode, FileType, Layout, Trash2, Cpu } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';

// Vibrant accent colors for zoomed-out visibility
function getAccent(type: string, isBackend: boolean) {
  if (isBackend) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
  if (type === 'TSX' || type === 'JSX') return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
  if (type === 'TS' || type === 'JS' || type === 'PY') return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
  return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
}

export const FileNode = React.memo(function FileNode({ data, selected }: any) {
  const isBackend = data.isBackend;
  const isHorizontal = data.direction !== 'TB';
  const accent = getAccent(data.type, isBackend);

  const pathParts = data.path ? data.path.split('/') : [];
  const dirPath = pathParts.length > 1
    ? pathParts.slice(Math.max(0, pathParts.length - 3), pathParts.length - 1).join('/')
    : '';

  const isBlastMode = data.hasBlastRadius;
  const isBlastConnected = data.blastConnected;
  const tier = data.blastTier;

  let blastBorder = 'var(--color-border)';
  let blastShadow: string | undefined = undefined;
  let blastBorderWidth = '1px';

  if (isBlastMode && isBlastConnected && tier > 0) {
    blastBorderWidth = '2px';
    if (tier === 1) {
      blastBorder = '#ef4444';
      blastShadow = '0 0 15px rgba(239, 68, 68, 0.4)';
    } else if (tier === 2) {
      blastBorder = '#f97316';
      blastShadow = '0 0 12px rgba(249, 115, 22, 0.35)';
    } else if (tier === 3) {
      blastBorder = '#eab308';
      blastShadow = '0 0 10px rgba(234, 179, 8, 0.3)';
    } else {
      blastBorder = 'var(--color-border-subtle)';
      blastShadow = '0 0 5px rgba(148, 163, 184, 0.1)';
      blastBorderWidth = '1px';
    }
  }

  return (
    <div className="relative transition-all duration-200">
      {/* Card */}
      <div
        className={`rounded-xl min-w-[260px] max-w-[320px] transition-all duration-200 border-l-4 ${selected
            ? 'shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 scale-[1.02]'
            : 'shadow-lg hover:shadow-xl'
          }`}
        style={{
          background: 'var(--color-surface-raised)',
          borderTop: `${blastBorderWidth} solid ${blastBorder}`,
          borderRight: `${blastBorderWidth} solid ${blastBorder}`,
          borderBottom: `${blastBorderWidth} solid ${blastBorder}`,
          borderLeftColor: accent.color,
          boxShadow: selected ? `0 0 24px ${accent.color}40, 0 4px 16px rgba(0,0,0,0.4)` : (blastShadow || `0 4px 16px rgba(0, 0, 0, 0.3)`),
        }}
      >
        {/* Handles */}
        <Handle
          type="target"
          position={isHorizontal ? Position.Left : Position.Top}
          id={isHorizontal ? "left" : "top"}
          className="!w-2.5 !h-2.5 !rounded-full !border-2"
          style={{
            background: 'var(--color-text-muted)',
            borderColor: 'var(--color-surface)',
            ...(isHorizontal ? { left: -6 } : { top: -6 }),
          }}
        />
        <Handle
          type="source"
          position={isHorizontal ? Position.Left : Position.Top}
          id={isHorizontal ? "left-source" : "top-source"}
          className="!opacity-0 !w-1 !h-1 !pointer-events-none"
          style={isHorizontal ? { left: -4 } : { top: -4 }}
        />

        {/* Dead code overlay */}
        {data.isDeadCode && (
          <div className="absolute inset-0 rounded-xl bg-red-950/20 pointer-events-none z-0" />
        )}

        {/* Content */}
        <div className="p-4 relative z-10">
          {/* Dead code badge */}
          {data.isDeadCode && (
            <div className="absolute -top-1 -right-1 flex items-center gap-1 z-20">
              <span className="px-2 py-0.5 bg-red-950/90 text-red-400 border border-red-800/60 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center">
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
                className="p-1 bg-[#1a1a24] hover:bg-red-900/80 text-red-400 hover:text-red-300 rounded-md border border-red-900/50 hover:border-red-700 transition-all duration-200 cursor-pointer"
                title="Delete File"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}

          <div className="flex items-start gap-3">
            {/* File icon */}
            <div
              className="p-2.5 rounded-lg shrink-0 mt-0.5 border shadow-inner"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {data.type === 'TSX' || data.type === 'JSX' ? (
                <Layout size={16} style={{ color: accent.color }} />
              ) : data.type === 'TS' || data.type === 'JS' ? (
                <FileCode size={16} style={{ color: accent.color }} />
              ) : isBackend ? (
                <Cpu size={16} style={{ color: accent.color }} />
              ) : (
                <FileType size={16} style={{ color: accent.color }} />
              )}
            </div>

            {/* File info */}
            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  {dirPath && (
                    <span className="text-[10px] text-text-dim font-mono truncate leading-tight mb-0.5">
                      {dirPath}/
                    </span>
                  )}
                  <span className="font-bold text-text-main text-sm truncate tracking-tight leading-tight">
                    {data.label}
                  </span>
                </div>

                {data.semantic_group && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap shrink-0">
                    {data.semantic_group}
                  </span>
                )}
              </div>

              {data.summary && (
                <p className="text-xs text-text-muted mt-2 leading-relaxed line-clamp-2">
                  {data.summary}
                </p>
              )}
            </div>
          </div>

          {/* Bottom badge */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle">
            {data.semantic_group ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-semibold bg-primary/10 text-primary-light border border-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-light animate-pulse" />
                AI Enriched
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider text-text-dim border border-border-subtle bg-surface">
                {data.subLabel && data.subLabel !== 'File' ? data.subLabel : data.type}
              </span>
            )}

            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent.color, opacity: 0.7 }} />
              <span className="text-[9px] text-text-dim font-medium">
                {isBackend ? 'Backend' : data.subLabel === 'UI Component' ? 'UI' : 'Script'}
              </span>
            </div>
          </div>
        </div>

        {/* Source handles */}
        <Handle
          type="source"
          position={isHorizontal ? Position.Right : Position.Bottom}
          id={isHorizontal ? "right" : "bottom"}
          className="!w-2.5 !h-2.5 !rounded-full !border-2"
          style={{
            background: 'var(--color-text-muted)',
            borderColor: 'var(--color-surface)',
            ...(isHorizontal ? { right: -6 } : { bottom: -6 }),
          }}
        />
        <Handle
          type="target"
          position={isHorizontal ? Position.Right : Position.Bottom}
          id={isHorizontal ? "right-target" : "bottom-target"}
          className="!opacity-0 !w-1 !h-1 !pointer-events-none"
          style={isHorizontal ? { right: -4 } : { bottom: -4 }}
        />
      </div>
    </div>
  );
  // Only re-render when fields that actually affect the visual output change.
  // Without this, every node re-renders on every click (new object refs from styledNodes).
}, (prev, next) =>
  prev.selected === next.selected &&
  prev.data.blastTier === next.data.blastTier &&
  prev.data.blastConnected === next.data.blastConnected &&
  prev.data.hasBlastRadius === next.data.hasBlastRadius &&
  prev.data.isDeadCode === next.data.isDeadCode &&
  prev.data.label === next.data.label &&
  prev.data.semantic_group === next.data.semantic_group &&
  prev.data.summary === next.data.summary
);
