import { getLayoutedElements } from '../utils/layout';

self.onmessage = (e) => {
  const { nodes, edges, direction, nodesep, ranksep } = e.data;
  
  try {
    const layouted = getLayoutedElements(nodes, edges, direction, nodesep, ranksep);
    self.postMessage({ type: 'success', data: layouted });
  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
