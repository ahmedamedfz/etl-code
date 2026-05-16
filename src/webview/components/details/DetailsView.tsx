import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TransformOperation } from '../../types/nodes';
import { TransformerConfigPanel } from './TransformerConfigPanel';
import { ConfigField } from './ConfigField';
import { WorkflowActions } from './WorkflowActions';
import { getConfigFieldMeta } from '../../utils/nodeConfigMeta';

const vscode = (window as any).acquireVsCodeApi();

const DetailsView = () => {
  const [nodeData, setNodeData] = useState<any>(null);
  const [localData, setLocalData] = useState<any>({});
  const activeNodeId = useRef<string | null>(null);
  const isEditing = useRef(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;

      if (msg.type !== 'updateDetails') {
        return;
      }

      const nd = msg.nodeData;

      if (!nd) {
        if (!isEditing.current) {
          activeNodeId.current = null;
          setNodeData(null);
          setLocalData({});
        }
        return;
      }

      if (nd.id !== activeNodeId.current) {
        activeNodeId.current = nd.id;
        setNodeData(nd);
        setLocalData(nd.data || {});
      } else {
        setNodeData(nd);
        if (!isEditing.current) {
          setLocalData(nd.data || {});
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const debouncedSend = useCallback((patch: any) => {
    const key = JSON.stringify(Object.keys(patch));
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(() => {
      if (activeNodeId.current) {
        vscode.postMessage({ type: 'updateNode', nodeId: activeNodeId.current, data: patch });
      }
    }, 400);
  }, []);

  const updateLocalField = (key: string, value: any) => {
    setLocalData((prev: any) => {
      const next = { ...prev, [key]: value };
      debouncedSend({ [key]: value });
      return next;
    });
  };

  const updateLocalConfig = (cfgKey: string, value: any) => {
    setLocalData((prev: any) => {
      const nextConfig = { ...(prev.config || {}), [cfgKey]: value };
      const nextData = { ...prev, config: nextConfig };
      debouncedSend({ config: nextConfig });
      return nextData;
    });
  };

  const replaceLocalConfig = (nextConfig: Record<string, string | number>) => {
    setLocalData((prev: any) => {
      const nextData = { ...prev, config: nextConfig };
      debouncedSend({ config: nextConfig });
      return nextData;
    });
  };

  const requestBrowse = (fieldKey: string, meta: ReturnType<typeof getConfigFieldMeta>) => {
    vscode.postMessage({
      type: 'pickFile',
      nodeId: activeNodeId.current,
      configKey: fieldKey,
      title: meta.browseTitle,
      extensions: meta.fileExtensions,
    });
  };

  const deleteField = (fieldId: string) => {
    const type = nodeData?.type;
    const fieldKey = type === 'source' || type === 'system' ? 'outputFields' : 'inputFields';
    const currentFields = localData[fieldKey] || nodeData.data?.[fieldKey] || [];
    const nextFields = currentFields.filter((field: any) => field.id !== fieldId);
    const patch = { [fieldKey]: nextFields };

    setLocalData((prev: any) => ({
      ...prev,
      ...patch,
    }));

    setNodeData((prev: any) =>
      prev
        ? {
            ...prev,
            data: {
              ...prev.data,
              ...patch,
            },
          }
        : prev
    );

    vscode.postMessage({ type: 'updateNode', nodeId: activeNodeId.current, data: patch });
  };

  if (!nodeData) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            color: 'var(--vscode-descriptionForeground)',
            textAlign: 'center',
            fontSize: '11px',
            fontStyle: 'italic',
            marginTop: '32px',
          }}
        >
          Select a node in the canvas to view its details.
        </div>
        <WorkflowActions postMessage={(msg) => vscode.postMessage(msg)} />
      </div>
    );
  }

  const { id, type } = nodeData;
  const subTypeKey =
    type === 'source'
      ? 'sourceType'
      : type === 'transformer'
        ? 'operation'
        : type === 'system'
          ? 'systemType'
          : 'targetType';
  const subTypeLabel =
    type === 'source'
      ? 'Source Type'
      : type === 'transformer'
        ? 'Operation'
        : type === 'system'
          ? 'Generator'
          : 'Target Type';
  const subTypeValue = localData[subTypeKey] || '';
  const displayFields: any[] =
    type === 'source' || type === 'system'
      ? localData.outputFields || nodeData.data?.outputFields || []
      : localData.inputFields || nodeData.data?.inputFields || [];
  const config = localData.config || {};

  return (
    <div
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        color: 'var(--vscode-foreground)',
        fontSize: '12px',
      }}
    >
      <div style={fieldGroup}>
        <label style={fieldLabel}>Node ID</label>
        <div style={readonlyBox}>{id}</div>
      </div>

      <div style={fieldGroup}>
        <label style={fieldLabel}>Label</label>
        <input
          style={inputStyle}
          type="text"
          value={localData.label || ''}
          onFocus={() => {
            isEditing.current = true;
          }}
          onBlur={() => {
            isEditing.current = false;
          }}
          onChange={(e) => updateLocalField('label', e.target.value)}
        />
      </div>

      <div style={fieldGroup}>
        <label style={fieldLabel}>{subTypeLabel}</label>
        <div
          style={{
            ...readonlyBox,
            color: '#f59e0b',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          {subTypeValue}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--vscode-widget-border)', paddingTop: '12px' }}>
        <label style={{ ...fieldLabel, marginBottom: '8px', display: 'block' }}>Configuration</label>
        {type === 'transformer' ? (
          <TransformerConfigPanel
            operation={subTypeValue as TransformOperation}
            config={config}
            inputFields={displayFields}
            onEditStart={() => {
              isEditing.current = true;
            }}
            onEditEnd={() => {
              isEditing.current = false;
            }}
            onConfigChange={replaceLocalConfig}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(config).map(([cfgKey, cfgValue]) => {
              const meta = getConfigFieldMeta(type, subTypeValue, cfgKey);
              const canBrowse =
                meta.kind === 'file-path' || meta.kind === 'db-file-path';

              return (
                <ConfigField
                  key={cfgKey}
                  fieldKey={cfgKey}
                  fieldValue={cfgValue}
                  meta={meta}
                  onEditStart={() => {
                    isEditing.current = true;
                  }}
                  onEditEnd={() => {
                    isEditing.current = false;
                  }}
                  onValueChange={(val) => updateLocalConfig(cfgKey, val)}
                  onBrowse={
                    canBrowse ? () => requestBrowse(cfgKey, meta) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {(type === 'source' || type === 'target') && (
        <button
          onClick={() =>
            vscode.postMessage({
              type: 'fetchSchema',
              nodeId: id,
              nodeType: type,
              subType: subTypeValue,
              config: config,
            })
          }
          style={btnSecondary}
        >
          <i className="fa-solid fa-download"></i> Fetch Schema / Fields
        </button>
      )}

      <div style={{ borderTop: '1px solid var(--vscode-widget-border)', paddingTop: '12px' }}>
        <label style={{ ...fieldLabel, marginBottom: '8px', display: 'block' }}>
          {type === 'system'
            ? 'Generated Fields'
            : type === 'transformer'
              ? 'Input Fields'
              : 'Schema Fields'}{' '}
          ({displayFields.length})
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {displayFields.length > 0 ? (
            displayFields.map((f: any) => (
              <div
                key={f.id}
                style={{
                  ...fieldRow,
                  ...(type === 'transformer' ? { cursor: 'grab' } : {}),
                }}
                draggable={type === 'transformer'}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/etl-field-id', f.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '11px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '9px',
                      color: 'var(--vscode-descriptionForeground)',
                      textTransform: 'uppercase',
                      fontFamily: 'monospace',
                    }}
                  >
                    {f.type}
                  </span>
                  {type !== 'system' && (
                    <button onClick={() => deleteField(f.id)} style={iconButton} title="Delete field">
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                fontSize: '10px',
                fontStyle: 'italic',
                color: 'var(--vscode-descriptionForeground)',
              }}
            >
              No fields loaded.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '16px', paddingBottom: '8px' }}>
        <WorkflowActions postMessage={(msg) => vscode.postMessage(msg)} />
      </div>
    </div>
  );
};

const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const fieldLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--vscode-descriptionForeground)',
};
const readonlyBox: React.CSSProperties = {
  background: 'var(--vscode-textCodeBlock-background)',
  border: '1px solid var(--vscode-widget-border)',
  borderRadius: '3px',
  padding: '4px 6px',
  fontSize: '11px',
  fontFamily: 'monospace',
  wordBreak: 'break-all',
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
const fieldRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '8px',
  background: 'var(--vscode-textCodeBlock-background)',
  padding: '4px 6px 4px 8px',
  borderRadius: '3px',
  border: '1px solid var(--vscode-widget-border)',
};
const iconButton: React.CSSProperties = {
  width: '22px',
  height: '22px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: '3px',
  background: 'transparent',
  color: 'var(--vscode-descriptionForeground)',
  cursor: 'pointer',
  fontSize: '10px',
};
const btnSecondary: React.CSSProperties = {
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: 'none',
  borderRadius: '2px',
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  width: '100%',
};

export default DetailsView;
