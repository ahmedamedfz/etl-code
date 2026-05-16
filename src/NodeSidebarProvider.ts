import * as vscode from 'vscode';
import { CanvasPanel } from './CanvasPanel';

export class NodeSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'etl-code.nodeSidebar';
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _onDidOpen?: () => void
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._disposables.forEach(disposable => disposable.dispose());
        this._disposables = [];
        this._view = webviewView;
        this._onDidOpen?.();

        this._disposables.push(
            webviewView.onDidChangeVisibility(() => {
                if (webviewView.visible) {
                    this._onDidOpen?.();
                }
            })
        );

        this._disposables.push(
            webviewView.onDidDispose(() => {
                this._disposables.forEach(disposable => disposable.dispose());
                this._disposables = [];
                this._view = undefined;
            })
        );

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data) => {
            switch (data.type) {
                case 'addNode':
                    if (CanvasPanel.currentPanel) {
                        CanvasPanel.currentPanel.postMessage({
                            type: 'addNode',
                            nodeType: data.nodeType,
                            subType: data.subType
                        });
                    } else {
                        vscode.window.showInformationMessage('Please open the ETL Canvas first!');
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'Sidebar.js'));
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
            <title>ETL Nodes</title>
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
