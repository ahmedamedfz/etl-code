import { MarkerType } from '@xyflow/react';

export const initialNodes: any[] = [];
export const initialEdges: any[] = [];

export const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#2563eb'
  },
  style: {
    stroke: '#2563eb',
    strokeWidth: 2.5
  }
};

export const connectionLineStyle = { stroke: '#2563eb', strokeWidth: 2.5 };

export const newEdgeStyle = {
  type: 'smoothstep' as const,
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#2563eb',
    width: 18,
    height: 18
  },
  style: {
    stroke: '#2563eb',
    strokeWidth: 2.5
  }
};
