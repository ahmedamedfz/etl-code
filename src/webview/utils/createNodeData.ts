import {
  ETLNodeData,
  SourceNodeData,
  TransformerNodeData,
  TargetNodeData,
  SourceType,
  TransformOperation,
  TargetType,
  SystemGeneratorType,
} from '../types/nodes';
import { createSystemNodeData } from './systemNode';
import { getDefaultTransformConfig } from './transformConfig';

export const createNodeData = (type: string, subType: string): ETLNodeData => {
  if (type === 'source') {
    return {
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

  if (type === 'transformer') {
    const operation = subType as TransformOperation;
    return {
      label: `New ${subType.toUpperCase()}`,
      operation,
      config: getDefaultTransformConfig(operation),
      inputFields: [],
      outputFields: [],
      mappings: []
    } as TransformerNodeData;
  }

  if (type === 'system') {
    return createSystemNodeData(subType as SystemGeneratorType);
  }

  let config: Record<string, unknown> = {};

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

  return {
    label: `New ${subType.toUpperCase()} Target`,
    targetType: subType as TargetType,
    config,
    inputFields: []
  } as TargetNodeData;
};
