import * as vscode from 'vscode';
import { CanvasPanel } from './CanvasPanel';
import { NodeSidebarProvider } from './NodeSidebarProvider';
import { NodeDetailsProvider } from './NodeDetailsProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('ETL Code extension is now active');

    // 1. Initialize Providers
    const nodeSidebarProvider = new NodeSidebarProvider(context.extensionUri, () => {
        CanvasPanel.createOrShow(context.extensionUri);
    });
    const nodeDetailsProvider = new NodeDetailsProvider(context.extensionUri);

    // 2. Hook up cross-provider communication (Event-Driven)
    // This allows CanvasPanel to talk to NodeDetailsProvider without circular imports
    CanvasPanel.onNodeSelected = (nodeData) => {
        nodeDetailsProvider.updateDetails(nodeData);
    };

    CanvasPanel.onNodeUpdated = (nodeData) => {
        nodeDetailsProvider.updateDetails(nodeData);
    };

    CanvasPanel.onNodesDeleted = (nodeIds) => {
        nodeDetailsProvider.clearDetailsForNodes(nodeIds);
    };

    // 3. Register WebviewViewProviders (Sidebar)
    const sidebarRegistration = vscode.window.registerWebviewViewProvider(
        NodeSidebarProvider.viewType,
        nodeSidebarProvider
    );

    const detailsRegistration = vscode.window.registerWebviewViewProvider(
        NodeDetailsProvider.viewType,
        nodeDetailsProvider
    );

    // 4. Register Commands
    const canvasCommand = vscode.commands.registerCommand('etl-code.openCanvas', () => {
        CanvasPanel.createOrShow(context.extensionUri);
    });

    const helloWorldCommand = vscode.commands.registerCommand('etl-code.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from etl-code!');
    });

    context.subscriptions.push(
        sidebarRegistration, 
        detailsRegistration, 
        canvasCommand, 
        helloWorldCommand
    );
}

export function deactivate() {}
