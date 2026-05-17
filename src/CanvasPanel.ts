import * as vscode from 'vscode';

export class CanvasPanel {
    public static currentPanel: CanvasPanel | undefined;
    public static readonly viewType = 'etlCanvas';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _isWebviewReady = false;
    private _pendingMessages: any[] = [];

    // Static listener for updating the detail provider
    public static onNodeSelected?: (nodeData: any) => void;
    public static onNodeUpdated?: (nodeData: any) => void;
    public static onNodesDeleted?: (nodeIds: string[]) => void;

    public static createOrShow(extensionUri: vscode.Uri) {
        // If we already have a panel, reveal it.
        if (CanvasPanel.currentPanel) {
            CanvasPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return CanvasPanel.currentPanel;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            CanvasPanel.viewType,
            'ETL Canvas',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
                retainContextWhenHidden: true,
            }
        );

        CanvasPanel.currentPanel = new CanvasPanel(panel, extensionUri);
        return CanvasPanel.currentPanel;
    }

    public static importWorkflow(extensionUri: vscode.Uri, workflow: unknown) {
        const panel = CanvasPanel.createOrShow(extensionUri);
        panel.postMessage({
            type: 'importWorkflow',
            workflow
        });
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._setWebviewMessageListener(this._panel.webview);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'executePipeline':
                        await this.handleExecutePipeline(message.data);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.type) {
                    case 'canvasReady':
                        this._isWebviewReady = true;
                        this._flushPendingMessages();
                        break;

                    case 'nodeSelected':
                        if (CanvasPanel.onNodeSelected) {
                            CanvasPanel.onNodeSelected(message.nodeData);
                        }
                        // Focus the node details view
                        vscode.commands.executeCommand('etl-code.nodeDetails.focus');
                        break;

                    case 'nodeDataUpdated':
                        if (CanvasPanel.onNodeUpdated) {
                            CanvasPanel.onNodeUpdated(message.nodeData);
                        }
                        break;

                    case 'nodesDeleted':
                        if (CanvasPanel.onNodesDeleted) {
                            CanvasPanel.onNodesDeleted(message.nodeIds || []);
                        }
                        break;

                    case 'workflowExported': {
                        const isPrompt = message.exportKind === 'prompt';
                        const doc = await vscode.workspace.openTextDocument({
                            content: message.content,
                            language: isPrompt ? 'markdown' : 'json'
                        });
                        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                        vscode.window.showInformationMessage(
                            isPrompt
                                ? 'MCP prompt workflow exported.'
                                : 'Full workflow JSON exported.'
                        );
                        break;
                    }

                    case 'workflowImported': {
                        vscode.window.showInformationMessage(
                            `Workflow imported (${message.nodeCount ?? 0} nodes).`
                        );
                        break;
                    }

                    case 'workflowImportFailed': {
                        vscode.window.showErrorMessage(`Workflow import failed: ${message.message}`);
                        break;
                    }

                    case 'importWorkflow':
                        this.postMessage(message);
                        break;

                    case 'exportWorkflow':
                    case 'exportWorkflowPrompt':
                        this.postMessage(message);
                        break;

                    case 'deleteNode':
                        // Relay the delete message back to the webview React state
                        this.postMessage(message);
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    private async handleExecutePipeline(data: any) {
        // We will dynamically import or use the ExecutionEngine
        const { ExecutionEngine } = await import('./pipeline/ExecutionEngine');
        const { OracleMockConnector } = await import('./db/OracleMockConnector');
        
        const engine = new ExecutionEngine();
        const connector = new OracleMockConnector();
        
        try {
            // Send starting event
            this.postMessage({ type: 'pipeline-event', event: 'started' });

            // Example hardcoded context for now, in reality data comes from the webview node config
            const context = {
                csvContent: data.csvContent || 'id,name\n1,Test',
                tableName: data.tableName || 'test_table',
                dbConnector: connector,
                aiMapping: data.aiMapping || {
                    mapping: [
                        { sourceField: 'id', targetField: 'user_id', confidenceScore: 1.0 },
                        { sourceField: 'name', targetField: 'user_name', confidenceScore: 1.0 }
                    ],
                    explanation: 'Default mapping'
                }
            };

            const result = await engine.execute(context);

            // Send completed event and results
            this.postMessage({ 
                type: 'pipeline-event', 
                event: 'completed',
                result 
            });

        } catch (error: any) {
            this.postMessage({ 
                type: 'pipeline-event', 
                event: 'error',
                error: error.message 
            });
        }
    }

    public dispose() {
        CanvasPanel.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public postMessage(message: any) {
        if (!this._isWebviewReady) {
            this._pendingMessages.push(message);
            return;
        }

        this._panel.webview.postMessage(message);
    }

    private _flushPendingMessages() {
        const pending = this._pendingMessages.splice(0);
        pending.forEach((message) => this._panel.webview.postMessage(message));
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'ETL Canvas';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'index.js'));
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} data: https://cdnjs.cloudflare.com; script-src 'nonce-${nonce}' 'unsafe-eval';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesUri}" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <title>ETL Canvas</title>
                <style>
                  body, html {
                    margin: 0; padding: 0; height: 100vh; width: 100vw; overflow: hidden;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                  }
                  #root { height: 100%; width: 100%; }
                </style>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}">
                    window.vscode = acquireVsCodeApi();
                </script>
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
