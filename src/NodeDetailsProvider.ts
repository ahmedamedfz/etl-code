import * as vscode from 'vscode';
import { CanvasPanel } from './CanvasPanel';
import { SchemaFetcher } from './services/SchemaFetcher';

export class NodeDetailsProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'etl-code.nodeDetails';
    private _view?: vscode.WebviewView;
    private _selectedNodeData: any = null;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'updateNode': {
                    this._applyNodePatch(data.nodeId, data.data);
                    if (CanvasPanel.currentPanel) {
                        CanvasPanel.currentPanel.postMessage({
                            type: 'updateNode',
                            nodeId: data.nodeId,
                            data: data.data
                        });
                    }
                    break;
                }
                case 'fetchSchema':
                    this._handleFetchSchema(data.nodeId, data.nodeType, data.subType, data.config);
                    break;
                case 'exportWorkflow': {
                    if (CanvasPanel.currentPanel) {
                        CanvasPanel.currentPanel.postMessage({
                            type: 'exportWorkflow'
                        });
                    }
                    break;
                }
            }
        });

        if (this._selectedNodeData) {
            this.updateDetails(this._selectedNodeData);
        }
    }

    private async _handleFetchSchema(nodeId: string, nodeType: string, subType: string, config: any) {
        let fields: any[] = [];
        try {
            if (!config || Object.keys(config).length === 0) {
                throw new Error('Node configuration is missing. Fill in the config fields first.');
            }

            if (subType === 'csv' || subType === 'excel') {
                const filePath = config.filePath;
                if (!filePath) {
                    throw new Error('File Path is required to fetch schema');
                }
                const delimiter = config.delimiter || ',';
                const skipRows = Number(config.skipRows) || 0;
                fields = await SchemaFetcher.fetchCsvSchema(filePath, delimiter, skipRows);
            } else if (subType === 'sqlite' || subType === 'postgres' || subType === 'mysql') {
                const dbPath = config.connectionString;
                const tableName = config.table;
                if (!dbPath || !tableName) {
                    throw new Error('Connection String and Table Name are required');
                }
                fields = await SchemaFetcher.fetchSqliteSchema(dbPath, tableName);
            } else if (subType === 'rest-api') {
                const url = config.url;
                if (!url) {
                    throw new Error('Endpoint URL is required');
                }
                fields = await SchemaFetcher.fetchRestApiSchema(url, config.method);
            } else {
                fields = [{ id: 'gen1', name: 'input_field', type: 'any' }];
            }

            if (CanvasPanel.currentPanel) {
                const fieldKey = nodeType === 'source' ? 'outputFields' : 'inputFields';
                CanvasPanel.currentPanel.postMessage({
                    type: 'updateNode',
                    nodeId: nodeId,
                    data: { [fieldKey]: fields }
                });

                this._applyNodePatch(nodeId, { [fieldKey]: fields });

                vscode.window.showInformationMessage(
                    `Schema loaded: ${fields.length} field(s) from ${subType.toUpperCase()}`
                );
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Schema Fetch Error: ${error.message}`);
        }
    }

    public updateDetails(nodeData: any) {
        this._selectedNodeData = nodeData;
        if (!this._view) {
            return;
        }
        // Send message to React app
        this._view.webview.postMessage({
            type: 'updateDetails',
            nodeData
        });
    }

    public clearDetailsForNodes(nodeIds: string[]) {
        if (!this._selectedNodeData || !nodeIds.includes(this._selectedNodeData.id)) {
            return;
        }

        this.updateDetails(null);
    }

    private _applyNodePatch(nodeId: string, data: any) {
        if (!this._selectedNodeData || this._selectedNodeData.id !== nodeId) {
            return;
        }

        const currentData = this._selectedNodeData.data || {};
        const nextData = {
            ...currentData,
            ...data
        };

        if (data.config && currentData.config) {
            nextData.config = {
                ...currentData.config,
                ...data.config
            };
        }

        this.updateDetails({
            ...this._selectedNodeData,
            data: nextData
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'Details.js'));
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} data: https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}' 'unsafe-eval';">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link href="${stylesUri}" rel="stylesheet">
            <title>Node Details</title>
            <style>
                body { padding: 0; margin: 0; background-color: var(--vscode-sideBar-background); }
            </style>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
