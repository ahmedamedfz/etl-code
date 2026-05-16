import * as vscode from 'vscode';
import { CanvasPanel } from './CanvasPanel';

export class NodeSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'etl-code.nodeSidebar';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
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
                case 'addNode':
                    if (CanvasPanel.currentPanel) {
                        CanvasPanel.currentPanel.postMessage({
                            type: 'addNode',
                            nodeType: data.nodeType
                        });
                    } else {
                        vscode.window.showInformationMessage('Please open the ETL Canvas first!');
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ETL Nodes</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 10px;
                    }
                    .node-btn {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        width: 100%;
                        padding: 10px;
                        margin-bottom: 10px;
                        border: 1px solid var(--vscode-button-secondaryBorder, #444);
                        background-color: var(--vscode-button-secondaryBackground, #333);
                        color: var(--vscode-button-secondaryForeground, #fff);
                        border-radius: 4px;
                        cursor: pointer;
                        text-align: left;
                        font-size: 13px;
                    }
                    .node-btn:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground, #444);
                    }
                    .icon {
                        font-size: 16px;
                    }
                </style>
            </head>
            <body>
                <button class="node-btn" onclick="addNode('source')">
                    <span class="icon">📥</span> Source Node
                </button>
                <button class="node-btn" onclick="addNode('transformer')">
                    <span class="icon">⚙️</span> Transformer Node
                </button>
                <button class="node-btn" onclick="addNode('target')">
                    <span class="icon">📤</span> Target Node
                </button>

                <script>
                    const vscode = acquireVsCodeApi();

                    function addNode(type) {
                        vscode.postMessage({
                            type: 'addNode',
                            nodeType: type
                        });
                    }
                </script>
            </body>
            </html>`;
    }
}
