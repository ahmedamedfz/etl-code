import React from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Connection,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  Node,
  Edge,
} from '@xyflow/react';
import { nodeTypes } from '../../CustomNodes';
import {
  connectionLineStyle,
  defaultEdgeOptions,
} from '../../constants/flowCanvas';

type EtlFlowCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  isValidConnection: (connection: Edge | Connection) => boolean;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
};

export function EtlFlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onNodeClick,
}: EtlFlowCanvasProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      connectionMode={ConnectionMode.Strict}
      connectionRadius={36}
      snapToGrid
      snapGrid={[20, 20]}
      selectNodesOnDrag={false}
      panOnScroll
      fitViewOptions={{ padding: 0.25 }}
      deleteKeyCode={['Backspace', 'Delete']}
      defaultEdgeOptions={defaultEdgeOptions}
      connectionLineStyle={connectionLineStyle}
      fitView
    >
      <Controls />
      <MiniMap />
      <Background
        variant={BackgroundVariant.Dots}
        gap={12}
        size={1}
      />
    </ReactFlow>
  );
}
