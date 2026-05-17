import * as vscode from 'vscode';
import { CanvasPanel } from './CanvasPanel';
import { NodeSidebarProvider } from './NodeSidebarProvider';
import { NodeDetailsProvider } from './NodeDetailsProvider';
import { ETLMCPServer } from './mcp/MCPServer';
import { configureEtlCodeMcpServer, isEtlCodeMcpConfigured, getMcpSettingsPath } from './utils/mcpConfig';

export function activate(context: vscode.ExtensionContext) {
    console.log('ETL Code extension is now active');

    // Configure MCP settings globally for Bob
    const mcpPort = 3001;
    try {
        if (!isEtlCodeMcpConfigured()) {
            configureEtlCodeMcpServer(mcpPort);
            vscode.window.showInformationMessage(
                `ETL Code MCP server configured at http://localhost:${mcpPort}/sse`
            );
            console.log(`MCP settings configured at: ${getMcpSettingsPath()}`);
        } else {
            console.log('ETL Code MCP server already configured');
        }
    } catch (error) {
        console.error('Failed to configure MCP settings:', error);
        vscode.window.showWarningMessage(
            'Failed to configure MCP settings. You may need to configure manually.'
        );
    }

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

    // Start MCP Server (SSE for external tools like IBM Bob to connect)
    const mcpServer = new ETLMCPServer((workflow) => {
        CanvasPanel.importWorkflow(context.extensionUri, workflow);
        vscode.window.showInformationMessage('Generated workflow imported to the ETL Canvas.');
    });
    mcpServer.startHttp(mcpPort).catch(err => {
        console.error("MCP Server failed to start", err);
        vscode.window.showErrorMessage(`MCP Server failed to start on port ${mcpPort}: ${err.message}`);
    });

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

export function deactivate() {
    console.log('ETL Code extension is deactivating');
    // Note: MCP settings remain in ~/.bob/settings/mcp_settings.json
    // They are not removed on deactivation to allow Bob to reconnect
    // Users can manually remove the configuration if needed
}
