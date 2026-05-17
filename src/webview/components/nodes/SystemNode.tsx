import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { SystemNodeData, Field } from '../../types/nodes';
import { NodeHeader } from './NodeHeader';

const deleteNode = (id: string) => {
  if ((window as any).deleteEtlNode) {
    (window as any).deleteEtlNode(id);
    return;
  }

  window.dispatchEvent(new CustomEvent('deleteNode', { detail: { nodeId: id } }));
};

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  'current-datetime': 'Current Date/Time',
  uuid: 'UUID Generator',
  'sequential-id': 'Sequential ID',
  'random-int': 'Random Integer'
};

const SystemFieldRow = ({ field }: { field: Field }) => (
  <div className="relative flex items-center justify-between px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
    <div className="flex items-center gap-2 overflow-hidden">
      <i className="fa-solid fa-microchip text-purple-500 text-[10px]"></i>
      <span className="text-[11px] font-medium truncate text-gray-700 dark:text-gray-300">
        {field.name}
      </span>
    </div>
    <span className="text-[9px] text-gray-400 uppercase font-mono">{field.type}</span>
    <Handle
      type="source"
      position={Position.Right}
      id={`output-${field.id}`}
      className="etl-field-handle !bg-purple-500"
      style={{ right: -6 }}
    />
  </div>
);

export const SystemNode = memo(({ id, data }: { id: string; data: SystemNodeData }) => {
  const hasFields = data.outputFields && data.outputFields.length > 0;
  const generatorLabel = SYSTEM_TYPE_LABELS[data.systemType] || data.systemType;

  return (
    <div className="relative bg-white dark:bg-gray-900 border-2 border-purple-500 rounded-lg shadow-xl min-w-[260px] overflow-visible">
      <NodeHeader
        label={data.label}
        type="System"
        colorClass="bg-purple-500"
        darkColorClass="bg-purple-600"
        icon="fa-microchip"
        onDelete={() => deleteNode(id)}
      />

      <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-900/30">
        <div className="text-[10px] font-semibold text-purple-800 dark:text-purple-200 uppercase tracking-wide">
          {generatorLabel}
        </div>
      </div>

      <div className="flex flex-col bg-white dark:bg-gray-900">
        {hasFields ? (
          data.outputFields.map((field) => (
            <SystemFieldRow key={field.id} field={field} />
          ))
        ) : (
          <div className="px-3 py-4 text-[10px] text-gray-400 italic text-center">
            No generated fields configured.
          </div>
        )}
      </div>
    </div>
  );
});
