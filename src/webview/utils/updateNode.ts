import { Edge } from '@xyflow/react';
import { Field, SystemNodeData } from '../types/nodes';
import { deriveTransformerOutputFields } from './connectionFields';
import { syncSystemOutputFieldName } from './systemNode';

type FlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown> & {
    config?: Record<string, unknown>;
    inputFields?: Field[];
    outputFields?: Field[];
    operation?: string;
  };
};

export const isSubTypeChange = (data: Record<string, unknown>) =>
  Boolean(
    data.sourceType ||
    data.operation ||
    data.targetType ||
    data.systemType
  );

export const mergeNodeData = (node: FlowNode, patch: Record<string, unknown>): FlowNode['data'] => {
  const newData = {
    ...node.data,
    ...patch
  };

  if (patch.config && node.data.config) {
    if (!isSubTypeChange(patch)) {
      newData.config = {
        ...node.data.config,
        ...patch.config
      };
    } else {
      newData.config = patch.config as Record<string, unknown>;
    }
  }

  if (node.type === 'transformer') {
    newData.outputFields = deriveTransformerOutputFields(
      newData.operation as Parameters<typeof deriveTransformerOutputFields>[0],
      (newData.inputFields as Field[]) || []
    );
  }

  if (node.type === 'system' && newData.config?.fieldName) {
    newData.outputFields = syncSystemOutputFieldName(
      newData as unknown as SystemNodeData,
      String(newData.config.fieldName)
    ).outputFields;
  }

  return newData;
};

export const getValidHandleSets = (node: FlowNode) => ({
  inputHandles: new Set([
    'node-target',
    ...((node.data.inputFields || []).map((field: Field) => `input-${field.id}`))
  ]),
  outputHandles: new Set([
    'node-source',
    ...((node.data.outputFields || []).map((field: Field) => `output-${field.id}`))
  ])
});

export const pruneInvalidEdges = (edges: Edge[], nodeId: string, node: FlowNode) => {
  const { inputHandles, outputHandles } = getValidHandleSets(node);

  return edges.filter((edge) => {
    if (edge.source === nodeId && edge.sourceHandle && !outputHandles.has(edge.sourceHandle)) {
      return false;
    }

    if (edge.target === nodeId && edge.targetHandle && !inputHandles.has(edge.targetHandle)) {
      return false;
    }

    return true;
  });
};
