export type SourceType =
  | 'csv'
  | 'excel'
  | 'sqlite'
  | 'postgres'
  | 'mysql'
  | 'rest-api';

export type TransformOperation =
  | 'filter'
  | 'select'
  | 'map'
  | 'aggregate'
  | 'join'
  | 'sort'
  | 'derive-column'
  | 'rename-column'
  | 'union'
  | 'deduplicate';

export type TargetType =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'mongodb'
  | 'rest-api';

export type SystemGeneratorType =
  | 'current-datetime'
  | 'uuid'
  | 'sequential-id'
  | 'random-int';

export interface Field {
  id: string;
  name: string;
  type: string;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  expression?: string;
  type?: string;
}

export interface BaseNodeData {
  label: string;
  config: Record<string, any>;
}

export interface SourceNodeData extends BaseNodeData {
  sourceType: SourceType;
  outputFields: Field[];
}

export interface TransformerNodeData extends BaseNodeData {
  operation: TransformOperation;

  inputFields: Field[];
  outputFields: Field[];

  mappings?: FieldMapping[];
}

export interface TargetNodeData extends BaseNodeData {
  targetType: TargetType;

  inputFields: Field[];
}

export interface SystemNodeData extends BaseNodeData {
  systemType: SystemGeneratorType;
  outputFields: Field[];
}

export type ETLNodeData =
  | SourceNodeData
  | TransformerNodeData
  | TargetNodeData
  | SystemNodeData;