import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const SourceNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900 border border-blue-500 rounded-md shadow-sm min-w-[150px]">
      <div className="font-bold text-sm text-blue-800 dark:text-blue-200">📥 Source</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data?.label || 'Data Source'}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

export const TransformerNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900 border border-yellow-500 rounded-md shadow-sm min-w-[150px]">
      <Handle type="target" position={Position.Left} />
      <div className="font-bold text-sm text-yellow-800 dark:text-yellow-200">⚙️ Transformer</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data?.label || 'Process Data'}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

export const TargetNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-2 bg-green-50 dark:bg-green-900 border border-green-500 rounded-md shadow-sm min-w-[150px]">
      <Handle type="target" position={Position.Left} />
      <div className="font-bold text-sm text-green-800 dark:text-green-200">📤 Target</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data?.label || 'Data Destination'}</div>
    </div>
  );
});

export const nodeTypes = {
  source: SourceNode,
  transformer: TransformerNode,
  target: TargetNode,
};
