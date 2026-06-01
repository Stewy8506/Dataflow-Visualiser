import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileCode, FileType, Layout, Trash2, Cpu, ChevronDown, ChevronUp, Box, Package, Hexagon, Shield, Plug } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';

// Vibrant accent colors for zoomed-out visibility
function getAccent(type: string, isBackend: boolean, isExternal: boolean) {
  if (isExternal) return { color: '#d946ef', bg: 'rgba(217, 70, 239, 0.15)' }; // Fuchsia
  if (isBackend) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
  if (type === 'TSX' || type === 'JSX') return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
  if (type === 'TS' || type === 'JS' || type === 'PY') return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
  return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
}

export const FileNode = React.memo(function FileNode({ data, selected }: any) {
  const isSearchMatch = data.isSearchMatch ?? true;
  const diffStatus = data.diffStatus; // 'added' | 'removed' | null
  const [isExpanded, setIsExpanded] = useState(false);
  const isDimmed = data.isDimmed ?? false;
  const isBackend = data.isBackend;
  const isHorizontal = data.direction !== 'TB';
  const accent = getAccent(data.type, isBackend, data.isExternal);

  const pathParts = data.path ? data.path.split('/') : [];
  const dirPath = pathParts.length > 1
    ? pathParts.slice(Math.max(0, pathParts.length - 3), pathParts.length - 1).join('/')
    : '';

  const isBlastMode = data.hasBlastRadius;
  const isBlastConnected = data.blastConnected;
  const tier = data.blastTier;
  const churnCount = data.churnCount || 0;

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
  } else if (churnCount > 0) {
    blastBorderWidth = '2px';
    if (churnCount > 20) {
      blastBorder = '#ef4444'; // Red for very high churn
      blastShadow = '0 0 15px rgba(239, 68, 68, 0.4)';
    } else if (churnCount > 10) {
      blastBorder = '#f97316'; // Orange for high churn
      blastShadow = '0 0 12px rgba(249, 115, 22, 0.35)';
    } else if (churnCount > 5) {
      blastBorder = '#eab308'; // Yellow for medium churn
      blastShadow = '0 0 10px rgba(234, 179, 8, 0.3)';
    } else {
      blastBorder = '#fcd34d'; // Amber-300 for low churn
      blastShadow = '0 0 5px rgba(252, 211, 77, 0.2)';
    }
  }

  if (data.isExternal) {
    return (
      <div className="relative transition-all duration-200 group">
        <div
          className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all duration-200 ${
            selected
              ? 'shadow-[0_0_20px_rgba(217,70,239,0.4)] z-10 scale-[1.05] border-fuchsia-500'
              : 'shadow-md hover:shadow-lg border-fuchsia-500/30 hover:border-fuchsia-500/60'
          } ${isSearchMatch ? '' : 'opacity-50'} ${isDimmed ? 'opacity-30' : ''} ${
            data.isDeadCode ? 'border-dashed !border-red-500/50 hover:!border-red-500' : ''
          }`}
          style={{ background: data.isDeadCode ? '#450a0a' : 'var(--color-surface)' }}
        >
          <Package size={14} style={{ color: data.isDeadCode ? '#ef4444' : accent.color }} />
          <span className={`text-[11px] font-bold tracking-wide truncate max-w-[250px] ${data.isDeadCode ? 'text-red-400 line-through' : 'text-text-main'}`}>
            {data.label}
          </span>
          {data.isDeadCode && (
            <span className="text-[9px] uppercase tracking-wider font-black text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded-md ml-1">
              Unused
            </span>
          )}
        </div>
        
        {!selected && (
          <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 w-auto whitespace-nowrap px-3 py-2 rounded-xl bg-surface border border-border shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl pointer-events-none delay-300">
            <div className="flex items-center gap-2">
              <Package size={14} style={{ color: data.isDeadCode ? '#ef4444' : accent.color }} />
              <span className="text-xs font-semibold text-text-main">
                {data.isDeadCode ? `Unused Package: ${data.label}` : `External Package: ${data.label}`}
              </span>
            </div>
          </div>
        )}

        <Handle
          type="target"
          position={isHorizontal ? Position.Left : Position.Top}
          id={isHorizontal ? "left" : "top"}
          className="!w-2 !h-2 !rounded-full !border-2"
          style={{
            background: 'var(--color-text-muted)',
            borderColor: 'var(--color-surface)',
            ...(isHorizontal ? { left: -5 } : { top: -5 }),
          }}
        />
        <Handle
          type="source"
          position={isHorizontal ? Position.Left : Position.Top}
          id={isHorizontal ? "left-source" : "top-source"}
          className="!opacity-0 !w-1 !h-1 !pointer-events-none"
          style={isHorizontal ? { left: -4 } : { top: -4 }}
        />
        <Handle
          type="source"
          position={isHorizontal ? Position.Right : Position.Bottom}
          id={isHorizontal ? "right" : "bottom"}
          className="!w-2 !h-2 !rounded-full !border-2"
          style={{
            background: 'var(--color-text-muted)',
            borderColor: 'var(--color-surface)',
            ...(isHorizontal ? { right: -5 } : { bottom: -5 }),
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
    );
  }

  return (
    <div className="relative transition-all duration-200 group">
      {/* Card */}
      <div
        className={`rounded-xl min-w-[260px] max-w-[320px] transition-all duration-200 border-l-4 ${selected
            ? 'shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 scale-[1.02]'
            : 'shadow-lg hover:shadow-xl'
          } ${isSearchMatch ? '' : 'opacity-50'} ${isDimmed ? 'opacity-30' : ''} ${diffStatus === 'added' ? 'ring-2 ring-emerald-500/50' : ''}`}
        style={{
          background: 'var(--color-surface-raised)',
          borderTop: `${blastBorderWidth} solid ${blastBorder}`,
          borderRight: `${blastBorderWidth} solid ${blastBorder}`,
          borderBottom: `${blastBorderWidth} solid ${blastBorder}`,
          borderLeftColor: accent.color,
          boxShadow: selected ? `0 0 24px ${accent.color}40, 0 4px 16px rgba(0,0,0,0.4)` : (blastShadow || `0 4px 16px rgba(0, 0, 0, 0.3)`),
        }}
      >
        {/* Hover Tooltip Card */}
        {!selected && (
          <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 w-64 p-3 rounded-xl bg-surface border border-border shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl pointer-events-none delay-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent.color }} />
              <span className="text-xs font-semibold text-text-main truncate">{data.label}</span>
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-text-dim">Path:</span>
                <span className="text-text-muted font-mono truncate max-w-[150px]">{data.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">Type:</span>
                <span className="text-text-muted">{data.subLabel || data.type}</span>
              </div>
              {churnCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-400/80">Git Churn:</span>
                  <span className="text-orange-400 font-bold">{churnCount} modifications</span>
                </div>
              )}
            </div>
            {data.summary && (
              <div className="mt-2 pt-2 border-t border-border-subtle">
                <p className="text-[10px] text-text-muted leading-relaxed line-clamp-3">
                  {data.summary}
                </p>
              </div>
            )}
          </div>
        )}
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
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main text-sm truncate tracking-tight leading-tight max-w-[140px]">
                      {data.label}
                    </span>
                    {data.exports && data.exports.length > 0 && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsExpanded(!isExpanded);
                        }}
                        className="p-0.5 rounded bg-surface border border-border-subtle hover:bg-surface-raised text-text-dim hover:text-text-main transition-colors ml-auto shadow-sm"
                        title="Toggle Symbols"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                {data.semantic_group && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap shrink-0">
                    {data.semantic_group}
                  </span>
                )}
                {data.tags && data.tags.length > 0 && (
                  <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[80px]">
                    {data.tags.map((tag: string) => {
                      if (tag.startsWith('angular')) {
                        return (
                          <span key={tag} className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/20" title={tag}>
                            <Shield size={8} /> {tag.split('-')[1]?.substring(0, 3)}
                          </span>
                        );
                      }
                      if (tag.startsWith('nest')) {
                        return (
                          <span key={tag} className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20" title={tag}>
                            <Hexagon size={8} /> {tag.split('-')[1]?.substring(0, 4)}
                          </span>
                        );
                      }
                      if (tag === 'injectable') {
                        return (
                          <span key={tag} className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20" title="Injectable">
                            <Plug size={8} /> INJ
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>
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
            <div className="flex items-center gap-2">
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
              
              {data.metrics && (
                <div 
                  className={`group/metrics relative px-2 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase border cursor-help ${
                    data.metrics.complexity_score === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    data.metrics.complexity_score === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  Cx: {data.metrics.complexity_score}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/metrics:block w-max bg-[#1a1a24] text-text-main text-[10px] p-2 rounded border border-border-subtle shadow-xl z-50">
                    <div className="font-bold border-b border-border-subtle pb-1 mb-1">Metrics</div>
                    <div>Functions: {data.metrics.function_count}</div>
                    <div>Imports: {data.metrics.import_count}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent.color, opacity: 0.7 }} />
              <span className="text-[9px] text-text-dim font-medium">
                {isBackend ? 'Backend' : data.subLabel === 'UI Component' ? 'UI' : 'Script'}
              </span>
            </div>
          </div>

          {/* Symbol Drill-Down (Expanded State) */}
          {isExpanded && data.exports && data.exports.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
              {data.exports.map((exp: any, i: number) => {
                const isUnused = data.unused_exports?.includes(exp.name);
                return (
                  <div key={i} className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded-lg bg-surface/80 border border-border-subtle hover:border-border transition-colors group/sym">
                    <div className="flex items-center gap-2 truncate">
                      <Box size={10} className="text-text-muted group-hover/sym:text-blue-400 transition-colors shrink-0" />
                      <span className={`font-mono truncate ${isUnused ? 'text-amber-500 line-through opacity-70' : 'text-text-dim'}`} title={exp.name}>
                        {exp.name}
                      </span>
                    </div>
                    {exp.is_default && (
                      <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ml-2">
                        DEF
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
  prev.data.isExternal === next.data.isExternal &&
  prev.data.churnCount === next.data.churnCount &&
  prev.data.label === next.data.label &&
  prev.data.semantic_group === next.data.semantic_group &&
  prev.data.summary === next.data.summary
);
