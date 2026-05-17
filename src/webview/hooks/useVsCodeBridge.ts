import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useReactFlow } from '@xyflow/react';
import { createNodeData } from '../utils/createNodeData';
import { getNodeId } from '../utils/nodeId';
import { mergeNodeData, isSubTypeChange, pruneInvalidEdges } from '../utils/updateNode';
import { getVsCodeApi, postToExtension } from '../utils/vscodeBridge';
import {
  serializeFullWorkflow,
  serializePromptWorkflow,
  deserializeWorkflow,
  buildMcpPrompt,
} from '../utils/workflowSerialization';

type SetNodes = Dispatch<SetStateAction<any[]>>;
type SetEdges = Dispatch<SetStateAction<any[]>>;

export const useVsCodeBridge = (
  setNodes: SetNodes,
  setEdges: SetEdges,
  deleteNodesById: (nodeIds: string[]) => void,
  prepareConnection: (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandleId?: string | null,
    targetHandleId?: string | null
  ) => unknown
) => {
  const { setCenter, getNodes, getEdges } = useReactFlow();

  const exportFull = useCallback(() => {
    return serializeFullWorkflow(getNodes(), getEdges());
  }, [getNodes, getEdges]);

  const exportPrompt = useCallback(() => {
    return serializePromptWorkflow(getNodes(), getEdges());
  }, [getNodes, getEdges]);

  const applyImportedWorkflow = useCallback(
    (workflowInput: unknown) => {
      const { nodes, edges } = deserializeWorkflow(workflowInput);
      setNodes(nodes);
      setEdges(edges);

      if (nodes.length > 0) {
        const first = nodes[0];
        setTimeout(() => {
          setCenter(first.position.x + 75, first.position.y + 25, {
            zoom: 1,
            duration: 600,
          });
        }, 50);
      }
    },
    [setNodes, setEdges, setCenter]
  );

  useEffect(() => {
    (window as Window & { deleteEtlNode?: (nodeId: string) => void }).deleteEtlNode = (nodeId: string) => {
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

      if (message.type === 'addNode') {
        const type = message.nodeType;
        const subType = message.subType;
        const currentNodes = getNodes();
        const offset = currentNodes.length * 20;
        const x = 250 + offset;
        const y = 250 + offset;
        const data = createNodeData(type, subType);

        const newNode = {
          id: getNodeId(),
          type,
          position: { x, y },
          data,
        };

        setNodes((nds) => nds.concat(newNode));

        setTimeout(() => {
          setCenter(x + 75, y + 25, {
            zoom: 1.2,
            duration: 800,
          });
        }, 50);
      } else if (message.type === 'updateNode') {
        setNodes((nds) => {
          const updatedNodes = nds.map((node) => {
            if (node.id === message.nodeId) {
              return {
                ...node,
                data: mergeNodeData(node, message.data),
              };
            }

            return node;
          });

          const subTypeChanged = isSubTypeChange(message.data);
          const updatedNode = updatedNodes.find((n) => n.id === message.nodeId);

          if (updatedNode && (message.data.inputFields || message.data.outputFields)) {
            setEdges((eds) => pruneInvalidEdges(eds, message.nodeId, updatedNode));
          }

          if (updatedNode && getVsCodeApi()) {
            setTimeout(() => {
              postToExtension({
                type: 'nodeDataUpdated',
                nodeData: {
                  id: updatedNode.id,
                  type: updatedNode.type,
                  position: updatedNode.position,
                  data: updatedNode.data,
                  activeConnections: [],
                },
              });
            }, 0);
          }

          if (subTypeChanged && updatedNode && getVsCodeApi()) {
            setTimeout(() => {
              postToExtension({
                type: 'nodeSelected',
                nodeData: {
                  id: updatedNode.id,
                  type: updatedNode.type,
                  position: updatedNode.position,
                  data: updatedNode.data,
                  activeConnections: [],
                },
              });
            }, 0);
          }

          return updatedNodes;
        });
      } else if (message.type === 'deleteNode') {
        deleteNodesById([message.nodeId]);
      } else if (message.type === 'exportWorkflow') {
        const workflow = exportFull();
        postToExtension({
          type: 'workflowExported',
          exportKind: 'full',
          workflow,
          content: JSON.stringify(workflow, null, 2),
        });
      } else if (message.type === 'exportWorkflowPrompt') {
        const workflow = exportPrompt();
        postToExtension({
          type: 'workflowExported',
          exportKind: 'prompt',
          workflow,
          content: buildMcpPrompt(workflow),
        });
      } else if (message.type === 'importWorkflow') {
        try {
          const imported = deserializeWorkflow(message.workflow);
          applyImportedWorkflow(message.workflow);
          postToExtension({
            type: 'workflowImported',
            nodeCount: imported.nodes.length,
          });
        } catch (error: unknown) {
          postToExtension({
            type: 'workflowImportFailed',
            message: error instanceof Error ? error.message : 'Import failed',
          });
        }
      }
    };

    window.addEventListener('deleteNode', handleLocalDelete);
    window.addEventListener('message', handleMessage);

    return () => {
      delete (window as Window & { deleteEtlNode?: (nodeId: string) => void }).deleteEtlNode;
      window.removeEventListener('deleteNode', handleLocalDelete);
      window.removeEventListener('message', handleMessage);
    };
  }, [
    deleteNodesById,
    setNodes,
    setEdges,
    setCenter,
    getNodes,
    exportFull,
    exportPrompt,
    applyImportedWorkflow,
    prepareConnection,
  ]);
};
