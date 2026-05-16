import React, { useRef } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import { EtlFlowCanvas } from './components/canvas/EtlFlowCanvas';
import { initialEdges, initialNodes } from './constants/flowCanvas';
import { useEtlConnections } from './hooks/useEtlConnections';
import { useNodeDeletion } from './hooks/useNodeDeletion';
import { useNodeSelection } from './hooks/useNodeSelection';
import { useVsCodeBridge } from './hooks/useVsCodeBridge';

function AppContent() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const { deleteNodesById, deleteSelection } = useNodeDeletion(setNodes, setEdges);
  const { isValidConnection, onConnect, prepareConnection } = useEtlConnections(setNodes, setEdges);
  const { onNodeClick } = useNodeSelection();

  useVsCodeBridge(setNodes, setEdges, deleteNodesById, prepareConnection);

  return (
    <div
      ref={canvasRef}
      className="w-full h-full"
      tabIndex={0}
      onClick={() => canvasRef.current?.focus()}
      onKeyDown={(event) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') {
          return;
        }

        const target = event.target as HTMLElement;
        const isTyping =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (isTyping) {
          return;
        }

        event.preventDefault();
        deleteSelection();
      }}
    >
      <EtlFlowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}
