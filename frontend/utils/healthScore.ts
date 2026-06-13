import { ParsedEdge, NodeMetrics } from '../types';

export function calculateHealthScore(
  nodeId: string, 
  edges: ParsedEdge[], 
  metrics?: NodeMetrics
): { score: number; color: string; label: string } {
  const coupling = edges.filter(e => e.source === nodeId).length;
  const blastRadius = edges.filter(e => e.target === nodeId).length;
  
  let complexityValue = 0;
  if (metrics?.complexity_score === 'Low') complexityValue = 1;
  else if (metrics?.complexity_score === 'Medium') complexityValue = 3;
  else if (metrics?.complexity_score === 'High') complexityValue = 5;

  // Since we don't have churn easily accessible, we will use a base value
  const churn = 0; 
  
  const score = coupling + (blastRadius * 1.5) + (complexityValue * 4) + churn;
  
  if (score <= 10) return { score, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'A' };
  if (score <= 25) return { score, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'B' };
  if (score <= 45) return { score, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'C' };
  return { score, color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'F' };
}
