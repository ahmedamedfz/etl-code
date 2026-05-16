import React, { useEffect, useRef, useState } from 'react';
import type { ConfigFieldMeta } from '../../utils/nodeConfigMeta';
import { formatPathForDisplay } from '../../utils/nodeConfigMeta';

const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const fieldLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--vscode-descriptionForeground)',
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
};
const pathPreview: React.CSSProperties = {
  background: 'var(--vscode-textCodeBlock-background)',
  border: '1px solid var(--vscode-widget-border)',
  borderRadius: '3px',
  padding: '6px 8px',
  fontSize: '11px',
  lineHeight: 1.35,
};
const browseBtn: React.CSSProperties = {
  flexShrink: 0,
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: 'none',
  borderRadius: '2px',
  padding: '5px 10px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
};

interface ConfigFieldProps {
  fieldKey: string;
  fieldValue: unknown;
  meta: ConfigFieldMeta;
  onValueChange: (val: unknown) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onBrowse?: () => void;
}

export const ConfigField = ({
  fieldValue,
  meta,
  onValueChange,
  onEditStart,
  onEditEnd,
  onBrowse,
}: ConfigFieldProps) => {
  const isPathField = meta.kind === 'file-path' || meta.kind === 'db-file-path';

  if (isPathField) {
    return (
      <PathConfigField
        fieldValue={String(fieldValue ?? '')}
        meta={meta}
        onValueChange={onValueChange}
        onEditStart={onEditStart}
        onEditEnd={onEditEnd}
        onBrowse={onBrowse}
      />
    );
  }

  return (
    <ScalarConfigField
      fieldValue={fieldValue}
      meta={meta}
      onValueChange={onValueChange}
      onEditStart={onEditStart}
      onEditEnd={onEditEnd}
    />
  );
};

const PathConfigField = ({
  fieldValue,
  meta,
  onValueChange,
  onEditStart,
  onEditEnd,
  onBrowse,
}: {
  fieldValue: string;
  meta: ConfigFieldMeta;
  onValueChange: (val: string) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onBrowse?: () => void;
}) => {
  const isFocused = useRef(false);
  const [draftValue, setDraftValue] = useState(fieldValue);
  const display = formatPathForDisplay(draftValue);

  useEffect(() => {
    if (!isFocused.current) {
      setDraftValue(fieldValue);
    }
  }, [fieldValue]);

  return (
    <div style={fieldGroup}>
      <label style={fieldLabel}>{meta.label}</label>
      {draftValue.trim() ? (
        <div style={pathPreview} title={draftValue}>
          <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{display.primary}</div>
          {display.secondary ? (
            <div
              style={{
                marginTop: '2px',
                fontSize: '10px',
                color: 'var(--vscode-descriptionForeground)',
                wordBreak: 'break-all',
              }}
            >
              {display.secondary}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            ...pathPreview,
            fontStyle: 'italic',
            color: 'var(--vscode-descriptionForeground)',
          }}
        >
          {meta.placeholder || 'Choose a file…'}
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          type="text"
          value={draftValue}
          placeholder={meta.placeholder}
          onFocus={() => {
            isFocused.current = true;
            onEditStart();
          }}
          onBlur={(e) => {
            isFocused.current = false;
            onValueChange(e.target.value);
            onEditEnd();
          }}
          onChange={(e) => {
            setDraftValue(e.target.value);
            onValueChange(e.target.value);
          }}
        />
        {onBrowse ? (
          <button
            type="button"
            style={browseBtn}
            title={meta.browseTitle || 'Browse…'}
            onClick={onBrowse}
          >
            <i className="fa-solid fa-folder-open"></i>
            Browse
          </button>
        ) : null}
      </div>
    </div>
  );
};

const ScalarConfigField = ({
  fieldValue,
  meta,
  onValueChange,
  onEditStart,
  onEditEnd,
}: {
  fieldValue: unknown;
  meta: ConfigFieldMeta;
  onValueChange: (val: unknown) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
}) => {
  const wasNumber = useRef(typeof fieldValue === 'number' || meta.kind === 'number');
  const isFocused = useRef(false);
  const [draftValue, setDraftValue] = useState(String(fieldValue ?? ''));

  useEffect(() => {
    if (typeof fieldValue === 'number') {
      wasNumber.current = true;
    }
    if (!isFocused.current) {
      setDraftValue(String(fieldValue ?? ''));
    }
  }, [fieldValue]);

  const commitValue = (raw: string) => {
    if (!wasNumber.current) {
      onValueChange(raw);
      return;
    }
    if (raw.trim() === '') {
      onValueChange('');
      return;
    }
    const nextNumber = Number(raw);
    if (!Number.isNaN(nextNumber)) {
      onValueChange(nextNumber);
    }
  };

  return (
    <div style={fieldGroup}>
      <label style={fieldLabel}>{meta.label}</label>
      <input
        style={inputStyle}
        type={wasNumber.current ? 'number' : 'text'}
        value={draftValue}
        placeholder={meta.placeholder}
        onFocus={() => {
          isFocused.current = true;
          onEditStart();
        }}
        onBlur={(e) => {
          isFocused.current = false;
          commitValue(e.target.value);
          onEditEnd();
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setDraftValue(raw);
          commitValue(raw);
        }}
      />
    </div>
  );
};