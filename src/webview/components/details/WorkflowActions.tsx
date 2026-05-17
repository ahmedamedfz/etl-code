import React, { useState } from 'react';

const btnPrimary: React.CSSProperties = {
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
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

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
};

const textareaStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '2px',
  padding: '6px 8px',
  fontSize: '11px',
  fontFamily: 'monospace',
  width: '100%',
  minHeight: '120px',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--vscode-errorForeground)',
  marginTop: '4px',
};

interface WorkflowActionsProps {
  postMessage: (message: unknown) => void;
}

export const WorkflowActions = ({ postMessage }: WorkflowActionsProps) => {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const handleImportApply = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      postMessage({ type: 'importWorkflow', workflow: parsed });
      setImportText('');
      setShowImport(false);
    } catch {
      setImportError('Invalid JSON. Paste workflow exported from this extension.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        onClick={() => postMessage({ type: 'exportWorkflow' })}
        style={btnPrimary}
      >
        <i className="fa-solid fa-file-export"></i>
        Export Workflow JSON
      </button>
      <button
        type="button"
        onClick={() => postMessage({ type: 'exportWorkflowPrompt' })}
        style={btnSecondary}
      >
        <i className="fa-solid fa-wand-magic-sparkles"></i>
        Export Prompt (MCP)
      </button>
      <button
        type="button"
        onClick={() => {
          setShowImport((prev) => !prev);
          setImportError(null);
        }}
        style={btnSecondary}
      >
        <i className="fa-solid fa-file-import"></i>
        Import Workflow JSON
      </button>
      {showImport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <textarea
            style={textareaStyle}
            value={importText}
            placeholder='Paste {"version":1,"format":"full",...}'
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
            }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" style={{ ...btnPrimary, flex: 1 }} onClick={handleImportApply}>
              Apply Import
            </button>
            <button
              type="button"
              style={{ ...btnSecondary, flex: 1 }}
              onClick={() => postMessage({ type: 'importWorkflowFromFile' })}
            >
              From File…
            </button>
          </div>
          {importError ? <div style={errorStyle}>{importError}</div> : null}
        </div>
      ) : null}
    </div>
  );
};
