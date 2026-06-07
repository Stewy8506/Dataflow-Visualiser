import { useState } from 'react';
import { Grid3x3, Search, AlertCircle, HelpCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface MatrixPanelProps {
  edges: any[];
}

export function MatrixPanel({ edges }: MatrixPanelProps) {
  const [filterQuery, setFilterQuery] = useState('');
  
  const setSelectedNode = useAppStore(s => s.setSelectedNode);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);

  if (!edges.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3 p-6">
        <Grid3x3 size={36} className="text-text-dim/20 animate-pulse" />
        <p className="text-sm text-text-dim font-semibold">No Dependency Data</p>
        <p className="text-xs text-text-dim/60 text-center max-w-xs">
          Analyze a codebase first to populate the structural dependency matrix.
        </p>
      </div>
    );
  }

  // Count edge connections to rank node importance
  const connectionCounts: Record<string, number> = {};
  edges.forEach(e => {
    const src = e.data?.originalSource || e.source;
    const tgt = e.data?.originalTarget || e.target;
    if (src) connectionCounts[src] = (connectionCounts[src] || 0) + 1;
    if (tgt) connectionCounts[tgt] = (connectionCounts[tgt] || 0) + 1;
  });

  // Extract and rank all unique nodes
  const allNodes = Array.from(
    new Set(
      edges
        .flatMap(e => [e.data?.originalSource || e.source, e.data?.originalTarget || e.target])
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => (connectionCounts[b] || 0) - (connectionCounts[a] || 0));

  // Apply search query filter
  const filteredNodes = filterQuery
    ? allNodes.filter(n => n.toLowerCase().includes(filterQuery.toLowerCase()))
    : allNodes.slice(0, 32); // Max 32 nodes by default to maintain readability

  if (filteredNodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background h-full">
        <div className="text-text-dim text-xs mb-2">No files match "{filterQuery}"</div>
        <button
          onClick={() => setFilterQuery('')}
          className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
        >
          Clear Filter
        </button>
      </div>
    );
  }

  const handleCellClick = (rowNode: string) => {
    const label = rowNode.split(/[/\\]/).pop() || rowNode;
    setSearchQuery(label);
    setSelectedNode({ id: rowNode, data: { label } });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
      {/* Search and Filter Row */}
      <div className="p-3 border-b border-border-subtle bg-surface-raised/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" size={14} />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter matrix rows & columns..."
            className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-main outline-none focus:border-blue-500/50 transition-colors placeholder:text-text-dim/60"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-dim hover:text-text-main bg-surface px-1.5 py-0.5 rounded border border-border"
            >
              Clear
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500/80 border border-blue-500/20" />
            <span className="text-text-dim">Row imports Col</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500/80 border border-emerald-500/20" />
            <span className="text-text-dim">Col imports Row</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-400 font-semibold">
            <div className="w-3 h-3 rounded bg-red-500 animate-pulse border border-red-400/20" />
            <span className="flex items-center gap-1">
              Reciprocal Import <AlertCircle size={10} />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-surface-raised border border-border-subtle" />
            <span className="text-text-dim">No relationship</span>
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-auto p-6 flex items-start justify-start">
        <div className="inline-block relative">
          {/* Column Header Row */}
          <div className="flex h-36 border-b border-border-subtle/40 pb-2">
            {/* Corner spacing matching the row label width */}
            <div className="w-44 shrink-0" />
            
            {filteredNodes.map((colNode) => {
              const filename = colNode.split(/[/\\]/).pop() || colNode;
              return (
                <div
                  key={colNode}
                  className="w-6 shrink-0 relative flex items-end justify-center group"
                >
                  <div
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 rotate-45 origin-bottom-left text-[9px] font-mono text-text-dim whitespace-nowrap select-none max-w-[120px] truncate group-hover:text-text-main group-hover:font-semibold transition-colors"
                    title={colNode}
                  >
                    {filename}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matrix Data Rows */}
          <div className="mt-2 space-y-1">
            {filteredNodes.map((rowNode) => {
              const rowFilename = rowNode.split(/[/\\]/).pop() || rowNode;
              return (
                <div key={rowNode} className="flex items-center h-5 group/row">
                  {/* Row Label */}
                  <div
                    className="w-44 pr-4 text-right text-[10px] font-mono text-text-dim group-hover/row:text-text-main group-hover/row:font-semibold transition-colors truncate select-none cursor-help"
                    title={rowNode}
                  >
                    {rowFilename}
                  </div>

                  {/* Intersections */}
                  {filteredNodes.map((colNode) => {
                    const rowImportsCol = edges.some(e =>
                      (e.data?.originalSource === rowNode && e.data?.originalTarget === colNode) ||
                      (e.source === rowNode && e.target === colNode)
                    );
                    const colImportsRow = edges.some(e =>
                      (e.data?.originalSource === colNode && e.data?.originalTarget === rowNode) ||
                      (e.source === colNode && e.target === rowNode)
                    );

                    let cellStyle = 'bg-surface-raised border border-border-subtle/30';
                    let titleText = `${rowFilename} has no direct relationship with ${colNode.split(/[/\\]/).pop()}`;

                    if (rowImportsCol && colImportsRow) {
                      cellStyle = 'bg-red-500 border border-red-400 shadow-sm shadow-red-500/20';
                      titleText = `⚠️ RECIPROCAL COUPLING: ${rowFilename} ⇄ ${colNode.split(/[/\\]/).pop()} (Double Import!)`;
                    } else if (rowImportsCol) {
                      cellStyle = 'bg-blue-500/80 hover:bg-blue-400 border border-blue-400/30';
                      titleText = `➔ ${rowFilename} imports ${colNode.split(/[/\\]/).pop()}`;
                    } else if (colImportsRow) {
                      cellStyle = 'bg-emerald-500/80 hover:bg-emerald-400 border border-emerald-400/30';
                      titleText = `➔ ${colNode.split(/[/\\]/).pop()} imports ${rowFilename}`;
                    }

                    if (rowNode === colNode) {
                      cellStyle = 'bg-transparent border border-dashed border-border/20';
                      titleText = `${rowFilename} (Self)`;
                    }

                    return (
                      <button
                        key={`${rowNode}-${colNode}`}
                        onClick={() => handleCellClick(rowNode)}
                        disabled={rowNode === colNode}
                        className={`w-6 h-5 rounded-sm transition-all duration-150 cursor-pointer shrink-0 flex items-center justify-center hover:scale-110 select-none ${cellStyle}`}
                        title={titleText}
                      >
                        {rowImportsCol && colImportsRow && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer statistics / count */}
      <div className="p-3 bg-surface-raised/20 border-t border-border-subtle text-[10px] text-text-dim flex items-center justify-between shrink-0 select-none">
        <div>
          Showing {filteredNodes.length} of {allNodes.length} project files.
          {!filterQuery && allNodes.length > 32 && " (Filtered to top active nodes)"}
        </div>
        <div className="flex items-center gap-1">
          <HelpCircle size={10} />
          <span>Click cells to inspect node in graph canvas</span>
        </div>
      </div>
    </div>
  );
}

