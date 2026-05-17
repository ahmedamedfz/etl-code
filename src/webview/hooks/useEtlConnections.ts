import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  addEdge,
  Connection,
  Edge,
  useReactFlow,
} from '@xyflow/react';
import { Field } from '../types/nodes';
import {
  deriveTransformerOutputFields,
  findOutputField,
  getNodeOutputFields,
  getTargetFieldsToMerge,
} from '../utils/connectionFields';
import { isValidEtlConnection } from '../utils/connectionValidation';
import { newEdgeStyle } from '../constants/flowCanvas';

type SetNodes = Dispatch<SetStateAction<any[]>>;
type SetEdges = Dispatch<SetStateAction<any[]>>;

export const useEtlConnections = (setNodes: SetNodes, setEdges: SetEdges) => {
  const { getNodes, getEdges } = useReactFlow();

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    return isValidEtlConnection(connection, getNodes(), getEdges());
  }, [getEdges, getNodes]);

  const prepareConnection = useCallback((
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandleId?: string | null,
    targetHandleId?: string | null
  ) => {
    const sourceNodeBeforeUpdate = getNodes().find((node) => node.id === sourceNodeId);
    const sourceField = sourceNodeBeforeUpdate
      ? findOutputField(sourceNodeBeforeUpdate, sourceHandleId)
      : null;
    let nextTargetHandle = targetHandleId || 'node-target';
    let nextMode: 'field' | 'rowset' = sourceHandleId?.startsWith('output-') ? 'field' : 'rowset';
    const fieldsToPropagate = sourceField
      ? [sourceField]
      : sourceNodeBeforeUpdate
        ? getNodeOutputFields(sourceNodeBeforeUpdate)
        : [];

    if (sourceField && targetHandleId === 'node-target') {
      nextTargetHandle = `input-${sourceField.id}`;
      nextMode = 'field';
    }

    setNodes((nds) => {
      const sourceNode = nds.find(n => n.id === sourceNodeId);
      const targetNode = nds.find(n => n.id === targetNodeId);

      if (!sourceNode || !targetNode) {
        return nds;
      }

      return nds.map((node) => {
        if (node.id !== targetNodeId) {
          return node;
        }

        const currentInputFields = node.data.inputFields || [];
        const newInputFields = [...currentInputFields];
        const fieldsToMerge = getTargetFieldsToMerge(node, targetHandleId, fieldsToPropagate);

        fieldsToMerge.forEach((pf: Field) => {
          if (!newInputFields.find((f: Field) => f.id === pf.id)) {
            newInputFields.push(pf);
          }
        });

        if (node.type === 'transformer') {
          return {
            ...node,
            data: {
              ...node.data,
              inputFields: newInputFields,
              outputFields: deriveTransformerOutputFields(node.data.operation, newInputFields)
            }
          };
        }

        if (node.type === 'target') {
          return {
            ...node,
            data: {
              ...node.data,
              inputFields: newInputFields
            }
          };
        }

        return node;
      });
    });

    return {
      targetHandle: nextTargetHandle,
      mode: nextMode
    };
  }, [getNodes, setNodes]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      if (!params.source || !params.target) {
        return;
      }

      const prepared = prepareConnection(
        params.source,
        params.target,
        params.sourceHandle,
        params.targetHandle
      );

      setEdges((eds) =>
        addEdge({
          ...params,
          targetHandle: prepared.targetHandle,
          id: `edge_${params.source}_${params.sourceHandle || 'node'}_${params.target}_${prepared.targetHandle}`,
          ...newEdgeStyle,
          data: {
            mode: prepared.mode
          }
        }, eds)
      );
    },
    [setEdges, prepareConnection],
  );

  return { isValidConnection, onConnect, prepareConnection };
};
