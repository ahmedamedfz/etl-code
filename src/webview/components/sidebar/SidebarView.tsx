import React from 'react';

const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : { postMessage: () => {} };

const SidebarView = () => {
  const addNode = (type: string, subType: string) => {
    vscode.postMessage({
      type: 'addNode',
      nodeType: type,
      subType: subType
    });
  };

  const configureMcp = () => {
    vscode.postMessage({ type: 'configureMcp' });
  };

  const openMcpGuide = () => {
    vscode.postMessage({ type: 'openMcpGuide' });
  };

  const sections = [
    {
      title: 'Sources',
      nodes: [
        { type: 'source', subType: 'csv', label: 'CSV Source', icon: 'fa-file-csv' },
        { type: 'source', subType: 'excel', label: 'Excel Source', icon: 'fa-file-excel' },
        { type: 'source', subType: 'sqlite', label: 'SQLite Source', icon: 'fa-database' },
        { type: 'source', subType: 'postgres', label: 'PostgreSQL Source', icon: 'fa-server' },
        { type: 'source', subType: 'mysql', label: 'MySQL Source', icon: 'fa-server' },
        { type: 'source', subType: 'rest-api', label: 'REST API Source', icon: 'fa-globe' },
      ]
    },
    {
      title: 'System',
      nodes: [
        { type: 'system', subType: 'current-datetime', label: 'Current Date/Time', icon: 'fa-clock' },
        { type: 'system', subType: 'uuid', label: 'UUID Generator', icon: 'fa-fingerprint' },
        { type: 'system', subType: 'sequential-id', label: 'Sequential ID', icon: 'fa-list-ol' },
        { type: 'system', subType: 'random-int', label: 'Random Integer', icon: 'fa-dice' },
      ]
    },
    {
      title: 'Transformers',
      nodes: [
        { type: 'transformer', subType: 'filter', label: 'Filter', icon: 'fa-filter' },
        { type: 'transformer', subType: 'select', label: 'Select', icon: 'fa-check-double' },
        { type: 'transformer', subType: 'map', label: 'Map', icon: 'fa-vial' },
        { type: 'transformer', subType: 'aggregate', label: 'Aggregate', icon: 'fa-chart-line' },
        { type: 'transformer', subType: 'join', label: 'Join', icon: 'fa-link' },
        { type: 'transformer', subType: 'sort', label: 'Sort', icon: 'fa-sort' },
        { type: 'transformer', subType: 'derive-column', label: 'Derive Column', icon: 'fa-plus' },
        { type: 'transformer', subType: 'rename-column', label: 'Rename Column', icon: 'fa-pen-to-square' },
      ]
    },
    {
      title: 'Targets',
      nodes: [
        { type: 'target', subType: 'postgres', label: 'PostgreSQL Target', icon: 'fa-server' },
        { type: 'target', subType: 'mysql', label: 'MySQL Target', icon: 'fa-server' },
        { type: 'target', subType: 'sqlite', label: 'SQLite Target', icon: 'fa-database' },
        { type: 'target', subType: 'mongodb', label: 'MongoDB Target', icon: 'fa-leaf' },
        { type: 'target', subType: 'rest-api', label: 'REST API Target', icon: 'fa-paper-plane' },
      ]
    }
  ];

  return (
    <div className="p-2 select-none">
      {/* MCP Configuration Section */}
      <div className="mb-6 pb-4 border-b border-vscode-panel-border">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-1">
          AI Assistant Setup
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={configureMcp}
            className="flex items-center gap-3 w-full p-2 text-xs text-left bg-vscode-button-bg hover:bg-vscode-button-hover text-vscode-button-fg rounded transition-all hover:translate-x-1"
          >
            <i className="fa-solid fa-robot w-4 text-center opacity-80"></i>
            Configure MCP Server
          </button>
          <button
            onClick={openMcpGuide}
            className="flex items-center gap-3 w-full p-2 text-xs text-left bg-vscode-button-secondary-bg hover:bg-vscode-button-secondary-hover text-vscode-button-secondary-fg rounded transition-all hover:translate-x-1"
          >
            <i className="fa-solid fa-book w-4 text-center opacity-80"></i>
            Setup Guide
          </button>
        </div>
      </div>

      {/* Node Sections */}
      {sections.map(section => (
        <div key={section.title} className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-1">
            {section.title}
          </div>
          <div className="flex flex-col gap-1">
            {section.nodes.map(node => (
              <button
                key={node.subType}
                onClick={() => addNode(node.type, node.subType)}
                className="flex items-center gap-3 w-full p-2 text-xs text-left bg-vscode-button-secondary-bg hover:bg-vscode-button-secondary-hover text-vscode-button-secondary-fg rounded transition-all hover:translate-x-1"
              >
                <i className={`fa-solid ${node.icon} w-4 text-center opacity-80`}></i>
                {node.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SidebarView;
