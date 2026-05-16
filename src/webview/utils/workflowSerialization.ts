import type { Edge, Node } from '@xyflow/react';
import type { Field } from '../types/nodes';
import { getNodeId } from './nodeId';

export const WORKFLOW_VERSION = 1;

export type WorkflowExportFormat = 'full' | 'prompt';

export interface WorkflowDocument {
  version: number;
  format: WorkflowExportFormat;
  nodes: unknown[];
  edges: unknown[];
}

const REACT_FLOW_NODE_KEYS = new Set([
  'position',
  'positionAbsolute',
  'width',
  'height',
  'selected',
  'dragging',
  'measured',
  'zIndex',
  'parentId',
  'extent',
  'expandParent',
  'ariaLabel',
  'focusable',
  'selectable',
  'deletable',
  'draggable',
]);

const REACT_FLOW_EDGE_KEYS = new Set([
  'selected',
  'animated',
  'markerEnd',
  'markerStart',
  'style',
  'label',
  'labelStyle',
  'labelShowBg',
  'labelBgStyle',
  'labelBgPadding',
  'labelBgBorderRadius',
  'interactionWidth',
]);

const stripKeys = <T extends Record<string, unknown>>(
  obj: T,
  keys: Set<string>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!keys.has(key)) {
      result[key] = value;
    }
  }
  return result;
};

const normalizeField = (field: Partial<Field>, index: number): Field => ({
  id: field.id || `field_${index + 1}`,
  name: field.name || `field_${index + 1}`,
  type: field.type || 'any',
});

const normalizeFields = (fields: unknown): Field[] => {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields.map((field, index) =>
    normalizeField(field as Partial<Field>, index)
  );
};

const trimNodeDataForPrompt = (data: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    label: data.label,
    config: data.config ?? {},
  };

  if (data.sourceType) {
    result.sourceType = data.sourceType;
  }
  if (data.targetType) {
    result.targetType = data.targetType;
  }
  if (data.operation) {
    result.operation = data.operation;
  }
  if (data.systemType) {
    result.systemType = data.systemType;
  }

  const fieldLists = ['outputFields', 'inputFields'] as const;
  for (const key of fieldLists) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      result[key] = (data[key] as Field[]).map(({ name, type }) => ({ name, type }));
    }
  }

  if (Array.isArray(data.mappings) && data.mappings.length > 0) {
    result.mappings = data.mappings;
  }

  return result;
};

export const serializeFullWorkflow = (
  nodes: Node[],
  edges: Edge[]
): WorkflowDocument => ({
  version: WORKFLOW_VERSION,
  format: 'full',
  nodes: nodes.map((node) => ({
    ...stripKeys(node as unknown as Record<string, unknown>, REACT_FLOW_NODE_KEYS),
    data: { ...(node.data as Record<string, unknown>) },
  })),
  edges: edges.map((edge) => ({
    ...stripKeys(edge as unknown as Record<string, unknown>, REACT_FLOW_EDGE_KEYS),
  })),
});

export const serializePromptWorkflow = (
  nodes: Node[],
  edges: Edge[]
): WorkflowDocument => ({
  version: WORKFLOW_VERSION,
  format: 'prompt',
  nodes: nodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: trimNodeDataForPrompt(node.data as Record<string, unknown>),
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
  })),
});

const layoutPosition = (index: number) => ({
  x: 250 + (index % 4) * 220,
  y: 120 + Math.floor(index / 4) * 140,
});

export const normalizeImportedNode = (raw: Record<string, unknown>, index: number): Node => {
  const id = typeof raw.id === 'string' ? raw.id : getNodeId();
  const type = typeof raw.type === 'string' ? raw.type : 'source';
  const data = (raw.data as Record<string, unknown>) || {};

  const normalizedData: Record<string, unknown> = {
    ...data,
    label: data.label ?? `Imported ${type}`,
    config: data.config ?? {},
  };

  if (Array.isArray(data.outputFields)) {
    normalizedData.outputFields = normalizeFields(data.outputFields);
  }
  if (Array.isArray(data.inputFields)) {
    normalizedData.inputFields = normalizeFields(data.inputFields);
  }

  const position =
    raw.position &&
    typeof raw.position === 'object' &&
    typeof (raw.position as { x?: unknown }).x === 'number' &&
    typeof (raw.position as { y?: unknown }).y === 'number'
      ? (raw.position as { x: number; y: number })
      : layoutPosition(index);

  return {
    id,
    type,
    position,
    data: normalizedData,
  } as Node;
};

export const normalizeImportedEdge = (raw: Record<string, unknown>): Edge | null => {
  if (typeof raw.source !== 'string' || typeof raw.target !== 'string') {
    return null;
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : `edge_${raw.source}_${raw.target}`,
    source: raw.source,
    target: raw.target,
    sourceHandle: typeof raw.sourceHandle === 'string' ? raw.sourceHandle : undefined,
    targetHandle: typeof raw.targetHandle === 'string' ? raw.targetHandle : undefined,
  } as Edge;
};

export const parseWorkflowDocument = (input: unknown): WorkflowDocument => {
  let parsed = input;

  if (typeof input === 'string') {
    parsed = JSON.parse(input);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Workflow JSON must be an object.');
  }

  const doc = parsed as Record<string, unknown>;
  const nodes = doc.nodes;
  const edges = doc.edges;

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error('Workflow JSON must include "nodes" and "edges" arrays.');
  }

  const format: WorkflowExportFormat =
    doc.format === 'prompt' || doc.format === 'full' ? doc.format : 'full';

  return {
    version: typeof doc.version === 'number' ? doc.version : WORKFLOW_VERSION,
    format,
    nodes,
    edges,
  };
};

export const deserializeWorkflow = (
  input: unknown
): { nodes: Node[]; edges: Edge[] } => {
  const doc = parseWorkflowDocument(input);

  const nodes = doc.nodes.map((node, index) =>
    normalizeImportedNode(node as Record<string, unknown>, index)
  );
  const nodeIds = new Set(nodes.map((node) => node.id));

  const edges = doc.edges
    .map((edge) => normalizeImportedEdge(edge as Record<string, unknown>))
    .filter((edge): edge is Edge => {
      if (!edge) {
        return false;
      }
      return nodeIds.has(edge.source) && nodeIds.has(edge.target);
    });

  return { nodes, edges };
};

export const buildMcpPrompt = (workflow: WorkflowDocument): string =>
  `You are helping build an ETL pipeline. Use this workflow definition (trimmed for MCP):

\`\`\`json
${JSON.stringify(workflow, null, 2)}
\`\`\`

Generate or update Python/pandas (or SQL) code that implements the sources, transforms, and targets described above. Respect connection configs and field names exactly.`;
