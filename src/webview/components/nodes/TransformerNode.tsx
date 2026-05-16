import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TransformerNodeData } from '../../types/nodes';
import { NodeHeader } from './NodeHeader';

const deleteNode = (id: string) => {
  if ((window as any).deleteEtlNode) {
    (window as any).deleteEtlNode(id);
    return;
  }

  window.dispatchEvent(new CustomEvent('deleteNode', { detail: { nodeId: id } }));
};

export const TransformerNode = memo(({ id, data }: { id: string, data: TransformerNodeData }) => {
  const hasInputFields  = data.inputFields?.length  > 0;
  const hasOutputFields = data.outputFields?.length > 0;

  return (
    <div className="relative bg-white dark:bg-gray-900 border-2 border-yellow-500 rounded-lg shadow-xl min-w-[260px] overflow-visible">
      <Handle
        type="target"
        position={Position.Top}
        id="node-target"
        className="etl-node-handle etl-node-handle-add !bg-yellow-600"
        style={{ left: 'calc(50% - 98px)', top: 49 }}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="node-source"
        className="etl-node-handle etl-node-handle-add !bg-yellow-600"
        style={{ left: 'calc(50% + 98px)', top: 49 }}
      />

      <NodeHeader 
        label={data.operation}
        type="Transform"
        colorClass="bg-yellow-500"
        darkColorClass="bg-yellow-600"
        icon="fa-gears"
        onDelete={() => deleteNode(id)}
      />

      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 flex justify-between items-center relative border-b border-yellow-100 dark:border-yellow-900/30">
        <div className="text-xs font-bold text-yellow-900 dark:text-yellow-100 truncate mx-auto">
          {data.label}
        </div>
      </div>

      {/* INPUT FIELDS */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[9px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
          <i className="fa-solid fa-arrow-right-to-bracket text-yellow-500 text-[8px]"></i>
          Input Fields
        </div>

        {hasInputFields ? (
          data.inputFields.map((field) => (
            <div key={`input-${field.id}`} className="relative flex items-center px-3 py-1.5 border-t border-gray-200 dark:border-gray-700">
              <Handle
                type="target"
                position={Position.Left}
                id={`input-${field.id}`}
                className="etl-field-handle !bg-yellow-500"
                style={{ left: -6 }}
              />
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{field.name}</span>
            </div>
          ))
        ) : (
          <div className="px-3 py-2 text-[10px] text-gray-400 italic">No inputs connected.</div>
        )}
      </div>

      {/* OUTPUT FIELDS */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[9px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
          <i className="fa-solid fa-arrow-right-from-bracket text-yellow-500 text-[8px]"></i>
          Output Fields
        </div>

        {hasOutputFields ? (
          data.outputFields.map((field) => (
            <div key={`output-${field.id}`} className="relative flex items-center justify-end px-3 py-1.5 border-t border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{field.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`output-${field.id}`}
                className="etl-field-handle !bg-yellow-600"
                style={{ right: -6 }}
              />
            </div>
          ))
        ) : (
          <div className="px-3 py-2 text-[10px] text-gray-400 italic text-center">No outputs.</div>
        )}
      </div>
    </div>
  );
});
