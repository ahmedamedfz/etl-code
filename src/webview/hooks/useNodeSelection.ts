import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { postToExtension } from '../utils/vscodeBridge';

export const useNodeSelection = () => {
  const { getEdges } = useReactFlow();

  const onNodeClick = useCallback((_event: React.MouseEvent, node: { id: string; type?: string; position: unknown; data: unknown }) => {
    const currentEdges = getEdges();

    const activeConnections = currentEdges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => ({
        type: e.source === node.id ? 'outgoing' : 'incoming',
        source: e.source,
        target: e.target
      }));

    postToExtension({
      type: 'nodeSelected',
      nodeData: {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        activeConnections
      }
    });
  }, [getEdges]);

  return { onNodeClick };
};
