import { Connection, Edge } from '@xyflow/react';
import { getHandleFieldId } from './connectionFields';

type FlowNode = {
  id: string;
  type?: string;
  data: {
    operation?: string;
  };
};

export const isValidEtlConnection = (
  connection: Connection | Edge,
  nodes: FlowNode[],
  edges: Edge[]
): boolean => {
  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);

  if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
    return false;
  }

  const sourceHandle = connection.sourceHandle;
  const targetHandle = connection.targetHandle;
  const isSourcePort =
    sourceHandle?.startsWith('output-') ||
    (sourceNode.type === 'transformer' && sourceHandle === 'node-source');
  const isTargetPort =
    targetHandle?.startsWith('input-') ||
    (
      (targetNode.type === 'transformer' || targetNode.type === 'target') &&
      targetHandle === 'node-target'
    );

  if (!isSourcePort || !isTargetPort) {
    return false;
  }

  if (sourceNode.type === 'target' || targetNode.type === 'source' || targetNode.type === 'system') {
    return false;
  }

  if (
    (sourceNode.type === 'source' || sourceNode.type === 'system') &&
    (targetNode.type === 'source' || targetNode.type === 'system')
  ) {
    return false;
  }

  const sourceFieldId = getHandleFieldId(connection.sourceHandle);
  const targetFieldId = getHandleFieldId(connection.targetHandle);
  const isFieldMapping = Boolean(sourceFieldId || targetFieldId);
  const targetIncomingEdges = edges.filter((edge) => edge.target === connection.target);
  const targetAllowsMultipleInputs =
    targetNode.type === 'transformer' &&
    (targetNode.data.operation === 'join' || targetNode.data.operation === 'union');

  if (!isFieldMapping && !targetAllowsMultipleInputs && targetIncomingEdges.length > 0) {
    return false;
  }

  const duplicate = edges.some((edge) =>
    edge.source === connection.source &&
    edge.target === connection.target &&
    edge.sourceHandle === connection.sourceHandle &&
    edge.targetHandle === connection.targetHandle
  );

  if (duplicate) {
    return false;
  }

  return true;
};
