import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useReactFlow } from '@xyflow/react';
import { postToExtension } from '../utils/vscodeBridge';

type SetNodes = Dispatch<SetStateAction<any[]>>;
type SetEdges = Dispatch<SetStateAction<any[]>>;

export const useNodeDeletion = (setNodes: SetNodes, setEdges: SetEdges) => {
  const { getNodes, getEdges } = useReactFlow();

  const deleteNodesById = useCallback((nodeIds: string[]) => {
    const idsToDelete = new Set(nodeIds);

    if (idsToDelete.size === 0) {
      return;
    }

    setNodes((nds) =>
      nds.filter((node) => !idsToDelete.has(node.id))
    );

    setEdges((eds) =>
      eds.filter(
        (edge) =>
          !idsToDelete.has(edge.source) &&
          !idsToDelete.has(edge.target)
      )
    );

    postToExtension({
      type: 'nodesDeleted',
      nodeIds: Array.from(idsToDelete)
    });
  }, [setEdges, setNodes]);

  const deleteSelection = useCallback(() => {
    const selectedNodeIds = getNodes()
      .filter((node) => node.selected)
      .map((node) => node.id);
    const selectedEdgeIds = getEdges()
      .filter((edge) => edge.selected)
      .map((edge) => edge.id);

    deleteNodesById(selectedNodeIds);

    if (selectedEdgeIds.length > 0) {
      const edgeIdsToDelete = new Set(selectedEdgeIds);
      setEdges((eds) => eds.filter((edge) => !edgeIdsToDelete.has(edge.id)));
    }
  }, [deleteNodesById, getEdges, getNodes, setEdges]);

  return { deleteNodesById, deleteSelection };
};
