import { Field, SystemGeneratorType, SystemNodeData } from '../types/nodes';

const formatSystemLabel = (systemType: SystemGeneratorType) =>
  systemType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const buildSystemOutputFields = (
  systemType: SystemGeneratorType,
  fieldName?: string
): Field[] => {
  switch (systemType) {
    case 'current-datetime':
      return [{ id: 'out_datetime', name: fieldName || 'current_timestamp', type: 'datetime' }];
    case 'uuid':
      return [{ id: 'out_uuid', name: fieldName || 'generated_id', type: 'string' }];
    case 'sequential-id':
      return [{ id: 'out_seq', name: fieldName || 'sequence_id', type: 'number' }];
    case 'random-int':
      return [{ id: 'out_random', name: fieldName || 'random_value', type: 'number' }];
    default:
      return [{ id: 'out_value', name: fieldName || 'value', type: 'string' }];
  }
};

export const createSystemNodeData = (systemType: SystemGeneratorType): SystemNodeData => {
  let config: Record<string, unknown> = { fieldName: '' };

  switch (systemType) {
    case 'current-datetime':
      config = { fieldName: 'current_timestamp', format: 'iso' };
      break;
    case 'uuid':
      config = { fieldName: 'generated_id', version: 'v4' };
      break;
    case 'sequential-id':
      config = { fieldName: 'sequence_id', startAt: 1, step: 1 };
      break;
    case 'random-int':
      config = { fieldName: 'random_value', min: 0, max: 100 };
      break;
  }

  const fieldName = String(config.fieldName || '');

  return {
    label: formatSystemLabel(systemType),
    systemType,
    config,
    outputFields: buildSystemOutputFields(systemType, fieldName)
  };
};

export const syncSystemOutputFieldName = (
  data: SystemNodeData,
  fieldName: string
): SystemNodeData => ({
  ...data,
  outputFields: buildSystemOutputFields(data.systemType, fieldName)
});
