import { Field, TransformOperation } from '../types/nodes';

export type TransformConfigFieldType =
  | 'expression'
  | 'field'
  | 'field-list'
  | 'text'
  | 'number'
  | 'select';

export interface TransformConfigFieldDef {
  key: string;
  label: string;
  type: TransformConfigFieldType;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
}

export const FIELD_REF_OPEN = '{{';
export const FIELD_REF_CLOSE = '}}';

export const fieldReferenceToken = (fieldName: string) =>
  `${FIELD_REF_OPEN}${fieldName}${FIELD_REF_CLOSE}`;

export const TRANSFORM_CONFIG_SCHEMAS: Record<TransformOperation, TransformConfigFieldDef[]> = {
  filter: [
    {
      key: 'condition',
      label: 'Filter condition',
      type: 'expression',
      placeholder: '{{age}} >= 18 && {{status}} == "active"',
      hint: 'Boolean expression. Click or drag input fields to reference them.'
    }
  ],
  select: [
    {
      key: 'columns',
      label: 'Columns',
      type: 'field-list',
      placeholder: '{{id}}, {{name}}, {{email}}',
      hint: 'Fields to keep in the output. Add expressions per column if needed.'
    }
  ],
  map: [
    {
      key: 'targetColumn',
      label: 'Target column',
      type: 'text',
      placeholder: 'normalized_email',
      hint: 'Optional output column name when mapping a single field.'
    },
    {
      key: 'expression',
      label: 'Map expression',
      type: 'expression',
      placeholder: 'lower({{email}})',
      hint: 'Transformation applied using connected input fields.'
    }
  ],
  aggregate: [
    {
      key: 'groupBy',
      label: 'Group by',
      type: 'field-list',
      placeholder: '{{country}}, {{region}}',
      hint: 'Fields used to group rows before aggregating.'
    },
    {
      key: 'aggregations',
      label: 'Aggregations',
      type: 'expression',
      placeholder: 'count({{id}}), sum({{amount}}), avg({{price}})',
      hint: 'One or more aggregate expressions referencing input fields.'
    }
  ],
  join: [
    {
      key: 'joinType',
      label: 'Join type',
      type: 'select',
      options: [
        { value: 'inner', label: 'Inner' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'full', label: 'Full' }
      ]
    },
    {
      key: 'leftKey',
      label: 'Left key',
      type: 'field',
      placeholder: 'customer_id',
      hint: 'Join key from the left / primary input.'
    },
    {
      key: 'rightKey',
      label: 'Right key',
      type: 'field',
      placeholder: 'customer_id',
      hint: 'Join key from the right / secondary input.'
    }
  ],
  sort: [
    {
      key: 'column',
      label: 'Sort column',
      type: 'field',
      placeholder: 'created_at',
      hint: 'Input field to sort by.'
    },
    {
      key: 'order',
      label: 'Order',
      type: 'select',
      options: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' }
      ]
    }
  ],
  'derive-column': [
    {
      key: 'columnName',
      label: 'New column name',
      type: 'text',
      placeholder: 'full_name',
      hint: 'Name of the derived output column.'
    },
    {
      key: 'expression',
      label: 'Derive expression',
      type: 'expression',
      placeholder: 'concat({{first_name}}, " ", {{last_name}})',
      hint: 'Expression built from connected input fields.'
    }
  ],
  'rename-column': [
    {
      key: 'sourceColumn',
      label: 'Source column',
      type: 'field',
      placeholder: 'old_name',
      hint: 'Existing input field to rename.'
    },
    {
      key: 'targetColumn',
      label: 'New column name',
      type: 'text',
      placeholder: 'new_name',
      hint: 'Renamed output column name.'
    }
  ],
  union: [
    {
      key: 'mode',
      label: 'Union mode',
      type: 'select',
      options: [
        { value: 'union', label: 'Union all rows' },
        { value: 'union-distinct', label: 'Union distinct' }
      ]
    },
    {
      key: 'columnMapping',
      label: 'Column mapping',
      type: 'expression',
      placeholder: '{{id}} -> id, {{name}} -> full_name',
      hint: 'Align columns across inputs when schemas differ.'
    }
  ],
  deduplicate: [
    {
      key: 'columns',
      label: 'Key columns',
      type: 'field-list',
      placeholder: '{{email}}, {{phone}}',
      hint: 'Fields that define duplicate rows.'
    },
    {
      key: 'keep',
      label: 'Keep',
      type: 'select',
      options: [
        { value: 'first', label: 'First occurrence' },
        { value: 'last', label: 'Last occurrence' }
      ]
    }
  ]
};

export const getDefaultTransformConfig = (
  operation: TransformOperation
): Record<string, string | number> => {
  const schema = TRANSFORM_CONFIG_SCHEMAS[operation];
  const config: Record<string, string | number> = {};

  for (const field of schema) {
    if (field.type === 'select' && field.options?.length) {
      config[field.key] = field.options[0].value;
    } else if (field.type === 'number') {
      config[field.key] = 0;
    } else {
      config[field.key] = '';
    }
  }

  return config;
};

export const mergeTransformConfig = (
  operation: TransformOperation,
  config: Record<string, unknown> = {}
): Record<string, string | number> => {
  const defaults = getDefaultTransformConfig(operation);
  const merged: Record<string, string | number> = { ...defaults };

  for (const field of TRANSFORM_CONFIG_SCHEMAS[operation]) {
    const value = config[field.key];
    if (value === undefined || value === null) {
      continue;
    }
    if (field.type === 'number' && typeof value === 'number') {
      merged[field.key] = value;
    } else {
      merged[field.key] = String(value);
    }
  }

  return merged;
};

export const insertIntoTextValue = (
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  insertText: string,
  fieldType: TransformConfigFieldType
): { nextValue: string; cursorPosition: number } => {
  const start = Math.max(0, Math.min(selectionStart, currentValue.length));
  const end = Math.max(start, Math.min(selectionEnd, currentValue.length));
  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);

  let token = insertText;
  if (fieldType === 'field-list' && before.length > 0 && !/,\s*$/.test(before)) {
    token = `, ${insertText}`;
  }

  const nextValue = `${before}${token}${after}`;
  const cursorPosition = before.length + token.length;

  return { nextValue, cursorPosition };
};

export const tokenForField = (
  field: Field,
  fieldType: TransformConfigFieldType
): string => {
  if (fieldType === 'field') {
    return field.name;
  }
  if (fieldType === 'field-list' || fieldType === 'expression') {
    return fieldReferenceToken(field.name);
  }
  return field.name;
};
