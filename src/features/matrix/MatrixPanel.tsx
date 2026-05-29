import { Grid3x3 } from 'lucide-react';

interface MatrixPanelProps {
  edges: any[];
}

export function MatrixPanel({ edges }: MatrixPanelProps) {
  if (!edges.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
        <Grid3x3 size={32} className="text-text-dim/30" />
        <p className="text-sm text-text-dim font-medium">No Data</p>
        <p className="text-xs text-text-dim/60">Load a project to see the dependency matrix.</p>
      </div>
    );
  }

  const nodes = Array.from(
    new Set(
      edges
        .flatMap(e => [e.data?.originalSource || e.source, e.data?.originalTarget || e.target])
        .filter(Boolean)
    )
  ).slice(0, 30);

  if (nodes.length === 0) {
    return <div className="text-text-dim text-xs p-4">No dependencies found.</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-4 bg-background">
      <div className="inline-block">
        {/* Column headers */}
        <div className="flex mb-1">
          <div className="w-32 shrink-0" />
          {nodes.map(n => (
            <div
              key={n}
              className="w-5 text-[8px] text-text-dim rotate-45 origin-bottom-left whitespace-nowrap truncate"
              title={n}
            >
              {n.split('/').pop() || n}
            </div>
          ))}
        </div>

        {/* Matrix rows */}
        {nodes.map(rowNode => (
          <div key={rowNode} className="flex items-center gap-1 mb-1">
            <div className="w-32 text-[10px] text-text-dim truncate text-right pr-2" title={rowNode}>
              {rowNode.split('/').pop() || rowNode}
            </div>
            {nodes.map(colNode => {
              const hasEdge = edges.some(e =>
                (e.data?.originalSource === rowNode && e.data?.originalTarget === colNode) ||
                (e.source === rowNode && e.target === colNode)
              );
              return (
                <div
                  key={`${rowNode}-${colNode}`}
                  className={`w-4 h-4 rounded-sm ${hasEdge ? 'bg-blue-500' : 'bg-surface-raised'} hover:bg-blue-400 transition-colors cursor-pointer`}
                  title={`${rowNode.split('/').pop()} → ${colNode.split('/').pop()}`}
                />
              );
            })}
          </div>
        ))}

        <div className="mt-4 text-[10px] text-text-dim">
          Showing top {nodes.length} nodes (Rows: Importer, Columns: Imported)
        </div>
      </div>
    </div>
  );
}
