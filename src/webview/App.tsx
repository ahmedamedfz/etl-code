import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import { nodeTypes } from './CustomNodes';

const initialNodes: any[] = [];
const initialEdges: any[] = [];

let id = 0;
const getId = () => `node_${id++}`;

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { setCenter, getNodes } = useReactFlow();

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'addNode') {
        const type = message.nodeType;
        // Position it slightly offset from previous nodes
        const currentNodes = getNodes();
        const offset = currentNodes.length * 20;
        
        // We can place it at 250, 250 plus offset
        const x = 250 + offset;
        const y = 250 + offset;

        const newNode = {
          id: getId(),
          type,
          position: { x, y },
          data: { label: `New ${type} node` },
        };

        setNodes((nds) => nds.concat(newNode));
        
        // Focus the canvas on the newly generated node
        setTimeout(() => {
          setCenter(x + 75, y + 25, { zoom: 1.2, duration: 800 });
        }, 50);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setNodes, setCenter, getNodes]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
