import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TargetNodeData, Field } from '../../types/nodes';
import { NodeHeader } from './NodeHeader';

const deleteNode = (id: string) => {
  if ((window as any).deleteEtlNode) {
    (window as any).deleteEtlNode(id);
    return;
  }

  window.dispatchEvent(new CustomEvent('deleteNode', { detail: { nodeId: id } }));
};

const TargetFieldRow = ({ field }: { field: Field }) => (
  <div className="relative flex items-center justify-between px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
    <Handle
      type="target"
      position={Position.Left}
      id={`input-${field.id}`}
      className="etl-field-handle !bg-green-500"
      style={{ left: -6 }}
    />
    <div className="flex items-center gap-2 overflow-hidden">
      <i className="fa-solid fa-table-list text-green-500 text-[10px]"></i>
      <span className="text-[11px] font-medium truncate text-gray-700 dark:text-gray-300">
        {field.name}
      </span>
    </div>
    <span className="text-[9px] text-gray-400 uppercase font-mono">{field.type}</span>
  </div>
);

export const TargetNode = memo(({ id, data }: { id: string, data: TargetNodeData }) => {
  const hasFields = data.inputFields && data.inputFields.length > 0;

  return (
    <div className="relative bg-white dark:bg-gray-900 border-2 border-green-500 rounded-lg shadow-xl min-w-[260px] overflow-visible">
      <NodeHeader 
        label={data.label}
        type="Target"
        colorClass="bg-green-500"
        darkColorClass="bg-green-600"
        icon="fa-file-export"
        onDelete={() => deleteNode(id)}
      />

      <div className="flex flex-col bg-white dark:bg-gray-900">
        {hasFields ? (
          data.inputFields.map((field) => (
            <TargetFieldRow key={field.id} field={field} />
          ))
        ) : (
          <div className="px-3 py-4 text-[10px] text-gray-400 italic text-center">
            No input fields. Connect a source or fetch schema.
          </div>
        )}
      </div>
    </div>
  );
});
