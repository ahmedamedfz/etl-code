import { TransformOperation, Field } from '../types/nodes';

export const getNodeOutputFields = (node: { type?: string; data: { outputFields?: Field[] } }): Field[] => {
  if (node.type === 'source' || node.type === 'transformer' || node.type === 'system') {
    return node.data.outputFields || [];
  }

  return [];
};

export const getHandleFieldId = (handleId?: string | null) => {
  if (!handleId) {
    return null;
  }

  if (handleId.startsWith('output-') || handleId.startsWith('input-')) {
    return handleId.replace(/^(output|input)-/, '');
  }

  return null;
};

export const findOutputField = (
  node: { type?: string; data: { outputFields?: Field[] } },
  handleId?: string | null
) => {
  const fieldId = getHandleFieldId(handleId);

  if (!fieldId) {
    return null;
  }

  return getNodeOutputFields(node).find((field) => field.id === fieldId) || null;
};

export const getTargetFieldsToMerge = (
  targetNode: { type?: string; data: { inputFields?: Field[] } },
  targetHandleId: string | null | undefined,
  fieldsToPropagate: Field[]
) => {
  if (targetNode.type !== 'target') {
    return fieldsToPropagate;
  }

  const isNodeTarget = !targetHandleId || targetHandleId === 'node-target';

  if (isNodeTarget) {
    return fieldsToPropagate;
  }

  const targetFieldId = getHandleFieldId(targetHandleId);
  const currentInputFields: Field[] = targetNode.data.inputFields || [];

  if (targetFieldId && currentInputFields.some((field) => field.id === targetFieldId)) {
    return [];
  }

  return fieldsToPropagate;
};

export const deriveTransformerOutputFields = (operation: TransformOperation, inputFields: Field[]) => {
  if (operation === 'aggregate') {
    return [
      { id: 'agg_1', name: 'group_key', type: 'string' },
      { id: 'agg_2', name: 'total_count', type: 'number' }
    ];
  }

  if (operation === 'select') {
    return inputFields.slice(0, 2);
  }

  return inputFields;
};
