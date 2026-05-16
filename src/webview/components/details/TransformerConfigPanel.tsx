import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Field, TransformOperation } from '../../types/nodes';
import {
  TRANSFORM_CONFIG_SCHEMAS,
  TransformConfigFieldDef,
  TransformConfigFieldType,
  mergeTransformConfig,
  insertIntoTextValue,
  tokenForField
} from '../../utils/transformConfig';

type ActiveInput = {
  key: string;
  fieldType: TransformConfigFieldType;
  element: HTMLInputElement | HTMLTextAreaElement;
};

interface TransformerConfigPanelProps {
  operation: TransformOperation;
  config: Record<string, unknown>;
  inputFields: Field[];
  onEditStart: () => void;
  onEditEnd: () => void;
  onConfigChange: (config: Record<string, string | number>) => void;
}

const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const fieldLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--vscode-descriptionForeground)'
};
const inputStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '2px',
  padding: '5px 7px',
  fontSize: '12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--vscode-editor-font-family, monospace)'
};
const hintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--vscode-descriptionForeground)',
  lineHeight: 1.35
};
const chipButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: '999px',
  border: '1px solid var(--vscode-widget-border)',
  background: 'var(--vscode-textCodeBlock-background)',
  color: 'var(--vscode-foreground)',
  fontSize: '10px',
  fontFamily: 'monospace',
  cursor: 'grab',
  userSelect: 'none'
};
const chipTypeStyle: React.CSSProperties = {
  fontSize: '8px',
  textTransform: 'uppercase',
  color: 'var(--vscode-descriptionForeground)'
};

const TransformConfigFieldInput = ({
  def,
  value,
  onEditStart,
  onEditEnd,
  onChange,
  registerActiveInput,
  onDrop
}: {
  def: TransformConfigFieldDef;
  value: string | number;
  onEditStart: () => void;
  onEditEnd: () => void;
  onChange: (value: string | number) => void;
  registerActiveInput: (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onDrop: (event: React.DragEvent) => void;
}) => {
  const isMultiline = def.type === 'expression' || def.type === 'field-list';
  const isFocused = useRef(false);
  const [draftValue, setDraftValue] = useState(String(value ?? ''));

  useEffect(() => {
    if (!isFocused.current) {
      setDraftValue(String(value ?? ''));
    }
  }, [value]);

  const acceptsFieldDrop = def.type !== 'select' && def.type !== 'number';

  const bindFieldInput = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    registerActiveInput(element);
  };

  const handleFocus = (
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    isFocused.current = true;
    bindFieldInput(event.currentTarget);
    onEditStart();
  };

  const handleBlur = () => {
    isFocused.current = false;
    bindFieldInput(null);
    onChange(draftValue);
    onEditEnd();
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!acceptsFieldDrop) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div style={fieldGroup}>
      <label style={fieldLabel}>{def.label}</label>
      {def.hint && <p style={hintStyle}>{def.hint}</p>}

      {def.type === 'select' ? (
        <select
          style={inputStyle}
          value={String(value)}
          onFocus={onEditStart}
          onBlur={onEditEnd}
          onChange={(event) => onChange(event.target.value)}
        >
          {(def.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : isMultiline ? (
        <textarea
          ref={bindFieldInput}
          style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
          value={draftValue}
          placeholder={def.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onDragOver={handleDragOver}
          onDrop={onDrop}
          onChange={(event) => {
            setDraftValue(event.target.value);
            onChange(event.target.value);
          }}
        />
      ) : (
        <input
          ref={bindFieldInput}
          style={inputStyle}
          type={def.type === 'number' ? 'number' : 'text'}
          value={draftValue}
          placeholder={def.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onDragOver={handleDragOver}
          onDrop={onDrop}
          onChange={(event) => {
            setDraftValue(event.target.value);
            onChange(event.target.value);
          }}
        />
      )}
    </div>
  );
};

export const TransformerConfigPanel = ({
  operation,
  config,
  inputFields,
  onEditStart,
  onEditEnd,
  onConfigChange
}: TransformerConfigPanelProps) => {
  const mergedConfig = mergeTransformConfig(operation, config);
  const schema = TRANSFORM_CONFIG_SCHEMAS[operation];
  const activeInputRef = useRef<ActiveInput | null>(null);

  const updateField = useCallback(
    (key: string, value: string | number) => {
      onConfigChange({ ...mergedConfig, [key]: value });
    },
    [mergedConfig, onConfigChange]
  );

  const insertField = useCallback(
    (field: Field, target?: ActiveInput | null) => {
      const active = target ?? activeInputRef.current;
      if (!active) {
        return;
      }

      const token = tokenForField(field, active.fieldType);
      const currentValue = String(mergedConfig[active.key] ?? '');
      const start = active.element.selectionStart ?? currentValue.length;
      const end = active.element.selectionEnd ?? start;
      const { nextValue, cursorPosition } = insertIntoTextValue(
        currentValue,
        start,
        end,
        token,
        active.fieldType
      );

      updateField(active.key, nextValue);

      requestAnimationFrame(() => {
        active.element.focus();
        active.element.setSelectionRange(cursorPosition, cursorPosition);
      });
    },
    [mergedConfig, updateField]
  );

  const registerActiveInput = (
    key: string,
    fieldType: TransformConfigFieldType,
    element: HTMLInputElement | HTMLTextAreaElement | null
  ) => {
    if (!element) {
      if (activeInputRef.current?.key === key) {
        activeInputRef.current = null;
      }
      return;
    }
    activeInputRef.current = { key, fieldType, element };
  };

  const handleDrop = (
    event: React.DragEvent,
    key: string,
    fieldType: TransformConfigFieldType
  ) => {
    event.preventDefault();
    const fieldId = event.dataTransfer.getData('application/etl-field-id');
    const field = inputFields.find((item) => item.id === fieldId);
    if (!field) {
      return;
    }
    const element = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    registerActiveInput(key, fieldType, element);
    insertField(field, { key, fieldType, element });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {inputFields.length > 0 && (
        <div style={fieldGroup}>
          <label style={fieldLabel}>Input fields</label>
          <p style={hintStyle}>Click or drag into a configuration field below.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {inputFields.map((field) => (
              <button
                key={field.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/etl-field-id', field.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => insertField(field)}
                style={chipButtonStyle}
                title={`Insert ${field.name}`}
              >
                <i className="fa-solid fa-grip-vertical" style={{ fontSize: '8px', opacity: 0.5 }} />
                <span>{field.name}</span>
                <span style={chipTypeStyle}>{field.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {schema.map((fieldDef) => (
        <TransformConfigFieldInput
          key={fieldDef.key}
          def={fieldDef}
          value={mergedConfig[fieldDef.key] ?? ''}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
          onChange={(val) => updateField(fieldDef.key, val)}
          registerActiveInput={(el) => registerActiveInput(fieldDef.key, fieldDef.type, el)}
          onDrop={(event) => handleDrop(event, fieldDef.key, fieldDef.type)}
        />
      ))}
    </div>
  );
};
