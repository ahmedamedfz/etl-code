import React, { useCallback, useEffect, useRef } from 'react';

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
  ConnectionMode,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';

import { nodeTypes } from './CustomNodes';

import {
  ETLNodeData,
  SourceNodeData,
  TransformerNodeData,
  TargetNodeData,
  SourceType,
  TransformOperation,
  TargetType,
  Field
} from './types/nodes';

const initialNodes: any[] = [];
const initialEdges: any[] = [];

let id = 0;

const getId = () => `node_${id++}`;

const getNodeOutputFields = (node: any): Field[] => {
  if (node.type === 'source' || node.type === 'transformer') {
    return node.data.outputFields || [];
  }

  return [];
};

const getHandleFieldId = (handleId?: string | null) => {
  if (!handleId) {
    return null;
  }

  if (handleId.startsWith('output-') || handleId.startsWith('input-')) {
    return handleId.replace(/^(output|input)-/, '');
  }

  return null;
};

const findOutputField = (node: any, handleId?: string | null) => {
  const fieldId = getHandleFieldId(handleId);

  if (!fieldId) {
    return null;
  }

  return getNodeOutputFields(node).find((field) => field.id === fieldId) || null;
};

const deriveTransformerOutputFields = (operation: TransformOperation, inputFields: Field[]) => {
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

function AppContent() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const {
    setCenter,
    getNodes,
    getEdges
  } = useReactFlow();

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

    if ((window as any).vscode) {
      (window as any).vscode.postMessage({
        type: 'nodesDeleted',
        nodeIds: Array.from(idsToDelete)
      });
    }
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

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    const currentEdges = getEdges();

    const activeConnections = currentEdges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => ({
        type: e.source === node.id ? 'outgoing' : 'incoming',
        source: e.source,
        target: e.target
      }));

    if ((window as any).vscode) {
      (window as any).vscode.postMessage({
        type: 'nodeSelected',
        nodeData: {
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
          activeConnections
        }
      });
    }
  }, [getEdges]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const sourceNode = currentNodes.find((node) => node.id === connection.source);
    const targetNode = currentNodes.find((node) => node.id === connection.target);

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
      (targetNode.type === 'transformer' && targetHandle === 'node-target');

    if (!isSourcePort || !isTargetPort) {
      return false;
    }

    if (sourceNode.type === 'target' || targetNode.type === 'source') {
      return false;
    }

    if (sourceNode.type === 'source' && targetNode.type === 'source') {
      return false;
    }

    const sourceFieldId = getHandleFieldId(connection.sourceHandle);
    const targetFieldId = getHandleFieldId(connection.targetHandle);
    const isFieldMapping = Boolean(sourceFieldId || targetFieldId);
    const targetIncomingEdges = currentEdges.filter((edge) => edge.target === connection.target);
    const targetAllowsMultipleInputs =
      targetNode.type === 'transformer' &&
      (targetNode.data.operation === 'join' || targetNode.data.operation === 'union');

    if (!isFieldMapping && !targetAllowsMultipleInputs && targetIncomingEdges.length > 0) {
      return false;
    }

    const duplicate = currentEdges.some((edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
    );

    if (duplicate) {
      return false;
    }

    return true;
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

        // Merge fields into target inputFields
        const currentInputFields = node.data.inputFields || [];
        const newInputFields = [...currentInputFields];
        
        fieldsToPropagate.forEach((pf: Field) => {
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
          type: 'smoothstep',
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
          },
          data: {
            mode: prepared.mode
          }
        }, eds)
      );
    },
    [setEdges, prepareConnection],
  );

  const exportWorkflow = useCallback(() => {
    return {
      nodes: getNodes(),
      edges: getEdges(),
    };
  }, [getNodes, getEdges]);

  const generateWorkflowPrompt = useCallback(() => {

    const workflow = exportWorkflow();

    const prompt = `Generate Python Pandas ETL pipeline from this workflow:

${JSON.stringify(workflow, null, 2)}
`;

    if ((window as any).vscode) {
      (window as any).vscode.postMessage({
        type: 'workflowExported',
        workflow,
        prompt
      });
    }

  }, [exportWorkflow]);

  useEffect(() => {
    (window as any).deleteEtlNode = (nodeId: string) => {
      deleteNodesById([nodeId]);
    };

    const handleLocalDelete = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId: string }>).detail?.nodeId;

      if (!nodeId) {
        return;
      }

      deleteNodesById([nodeId]);
    };

    const handleMessage = (event: MessageEvent) => {

      const message = event.data;

      // ADD NODE
      if (message.type === 'addNode') {

        const type = message.nodeType;

        const subType = message.subType;

        const currentNodes = getNodes();

        const offset = currentNodes.length * 20;

        const x = 250 + offset;

        const y = 250 + offset;

        let data: ETLNodeData;

        // SOURCE
        if (type === 'source') {

          data = {
            label: `New ${subType.toUpperCase()} Source`,

            sourceType: subType as SourceType,

            config:
              (subType === 'csv' || subType === 'excel')
                ? {
                  filePath: '',
                  delimiter: ',',
                  skipRows: 0
                }
                : (
                  subType === 'sqlite' ||
                  subType === 'postgres' ||
                  subType === 'mysql'
                )
                  ? {
                    connectionString: '',
                    table: ''
                  }
                  : {
                    url: '',
                    method: 'GET'
                  },

            outputFields: []

          } as SourceNodeData;
        }

        // TRANSFORMER
        else if (type === 'transformer') {

          let config: any = {};

          switch (subType) {

            case 'filter':
              config = {
                condition: ''
              };
              break;

            case 'aggregate':
              config = {
                groupBy: '',
                aggregations: ''
              };
              break;

            case 'sort':
              config = {
                column: '',
                order: 'asc'
              };
              break;

            case 'join':
              config = {
                joinType: 'inner',
                leftKey: '',
                rightKey: ''
              };
              break;

            case 'map':
              config = {
                expression: ''
              };
              break;

            default:
              config = {};
          }

          data = {
            label: `New ${subType.toUpperCase()}`,

            operation: subType as TransformOperation,

            config,

            inputFields: [],

            outputFields: [],

            mappings: []

          } as TransformerNodeData;
        }

        // TARGET
        else {

          let config: any = {};

          if (
            subType === 'postgres' ||
            subType === 'mysql' ||
            subType === 'sqlite' ||
            subType === 'mongodb'
          ) {

            config = {
              connectionString: '',
              table: '',
              mode: 'append'
            };
          }

          if (subType === 'rest-api') {

            config = {
              url: '',
              method: 'POST',
              headers: '{}'
            };
          }

          data = {
            label: `New ${subType.toUpperCase()} Target`,

            targetType: subType as TargetType,

            config,

            inputFields: []

          } as TargetNodeData;
        }

        const newNode = {
          id: getId(),
          type,
          position: { x, y },
          data,
        };

        setNodes((nds) => nds.concat(newNode));

        setTimeout(() => {
          setCenter(x + 75, y + 25, {
            zoom: 1.2,
            duration: 800
          });
        }, 50);
      }

      // UPDATE NODE
      else if (message.type === 'updateNode') {

        setNodes((nds) => {

          const updatedNodes = nds.map((node) => {

            if (node.id === message.nodeId) {

              const newData = {
                ...node.data,
                ...message.data
              };

              // deep merge config
              if (
                message.data.config &&
                node.data.config
              ) {

                const isSubTypeChange =
                  message.data.sourceType ||
                  message.data.operation ||
                  message.data.targetType;

                if (!isSubTypeChange) {
                  newData.config = {
                    ...node.data.config,
                    ...message.data.config
                  };
                } else {
                  newData.config = message.data.config;
                }
              }

              if (node.type === 'transformer') {
                newData.outputFields = deriveTransformerOutputFields(
                  newData.operation,
                  newData.inputFields || []
                );
              }

              return {
                ...node,
                data: newData
              };
            }

            return node;
          });

          const isSubTypeChange =
            message.data.sourceType ||
            message.data.operation ||
            message.data.targetType;

          const updatedNode = updatedNodes.find(
            n => n.id === message.nodeId
          );

          if (updatedNode && (message.data.inputFields || message.data.outputFields)) {
            const validInputHandles = new Set([
              'node-target',
              ...((updatedNode.data.inputFields || []).map((field: Field) => `input-${field.id}`))
            ]);
            const validOutputHandles = new Set([
              'node-source',
              ...((updatedNode.data.outputFields || []).map((field: Field) => `output-${field.id}`))
            ]);

            setEdges((eds) =>
              eds.filter((edge) => {
                if (edge.source === message.nodeId && edge.sourceHandle && !validOutputHandles.has(edge.sourceHandle)) {
                  return false;
                }

                if (edge.target === message.nodeId && edge.targetHandle && !validInputHandles.has(edge.targetHandle)) {
                  return false;
                }

                return true;
              })
            );
          }

          if (
            updatedNode &&
            (window as any).vscode
          ) {
            setTimeout(() => {
              (window as any).vscode.postMessage({
                type: 'nodeDataUpdated',
                nodeData: {
                  id: updatedNode.id,
                  type: updatedNode.type,
                  position: updatedNode.position,
                  data: updatedNode.data,
                  activeConnections: []
                }
              });
            }, 0);
          }

          if (isSubTypeChange) {

            if (
              updatedNode &&
              (window as any).vscode
            ) {

              setTimeout(() => {

                (window as any).vscode.postMessage({
                  type: 'nodeSelected',
                  nodeData: {
                    id: updatedNode.id,
                    type: updatedNode.type,
                    position: updatedNode.position,
                    data: updatedNode.data,
                    activeConnections: []
                  }
                });

              }, 0);
            }
          }

          return updatedNodes;
        });
      }

      // DELETE NODE
      else if (message.type === 'deleteNode') {
        deleteNodesById([message.nodeId]);
      }

      // EXPORT
      else if (message.type === 'exportWorkflow') {
        generateWorkflowPrompt();
      }
    };

    window.addEventListener('deleteNode', handleLocalDelete);
    window.addEventListener('message', handleMessage);

    return () => {
      delete (window as any).deleteEtlNode;
      window.removeEventListener('deleteNode', handleLocalDelete);
      window.removeEventListener('message', handleMessage);
    };

  }, [
    deleteNodesById,
    setNodes,
    setEdges,
    setCenter,
    getNodes,
    generateWorkflowPrompt,
    prepareConnection
  ]);

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
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#2563eb'
          },
          style: {
            stroke: '#2563eb',
            strokeWidth: 2.5
          }
        }}
        connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 2.5 }}
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
