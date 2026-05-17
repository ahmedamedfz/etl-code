import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CanvasPanel } from './CanvasPanel';
import { NodeSidebarProvider } from './NodeSidebarProvider';
import { NodeDetailsProvider } from './NodeDetailsProvider';
import { MCPManager } from './mcp/MCPManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('ETL Code extension is now active');

    // Initialize MCP Manager for auto-starting the MCP server
    const mcpManager = new MCPManager(context);
    
    // Auto-start MCP server on extension activation
    mcpManager.startServer().then(success => {
        if (success) {
            console.log('MCP server auto-started successfully');
        } else {
            console.log('MCP server auto-start skipped or failed');
        }
    }).catch(error => {
        console.error('Error auto-starting MCP server:', error);
    });

    // Helper function to get MCP server configuration
    const getMcpServerConfig = () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }
        
        const serverPath = path.join(workspaceFolder.uri.fsPath, 'dist', 'mcp', 'server-entry.js');
        
        return {
            name: 'etl-code',
            config: {
                command: 'node',
                args: [serverPath],
                env: {},
                disabled: false
            },
            serverPath
        };
    };

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

    // Command to configure MCP server in Bob
    const configureMcpCommand = vscode.commands.registerCommand('etl-code.configureMcpServer', async () => {
        const mcpConfig = getMcpServerConfig();
        
        if (!mcpConfig) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a workspace.');
            return;
        }

        // Check if server file exists
        if (!fs.existsSync(mcpConfig.serverPath)) {
            const compile = await vscode.window.showErrorMessage(
                'MCP server file not found. Would you like to compile the project first?',
                'Compile Now',
                'Cancel'
            );
            
            if (compile === 'Compile Now') {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const terminal = vscode.window.createTerminal({
                        name: 'ETL Compile',
                        cwd: workspaceFolder.uri.fsPath
                    });
                    terminal.show();
                    terminal.sendText('pnpm run compile');
                    vscode.window.showInformationMessage('Compiling project... Run this command again after compilation completes.');
                }
            }
            return;
        }

        // Show configuration instructions
        const configJson = JSON.stringify({
            mcpServers: {
                [mcpConfig.name]: mcpConfig.config
            }
        }, null, 2);

        const action = await vscode.window.showInformationMessage(
            'To configure the MCP server in Bob:\n\n' +
            '1. Open Bob Settings (gear icon)\n' +
            '2. Navigate to "MCP Servers" section\n' +
            '3. Add the configuration shown in the next step\n\n' +
            'Click "Copy Config" to copy the configuration to clipboard.',
            'Copy Config',
            'Open Setup Guide',
            'Cancel'
        );

        if (action === 'Copy Config') {
            await vscode.env.clipboard.writeText(configJson);
            vscode.window.showInformationMessage(
                'MCP server configuration copied to clipboard! Paste it in Bob Settings → MCP Servers.',
                'Open Bob Settings'
            ).then(result => {
                if (result === 'Open Bob Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:saoudrizwan.claude-dev');
                }
            });
        } else if (action === 'Open Setup Guide') {
            vscode.commands.executeCommand('etl-code.openMcpSetupGuide');
        }
    });

    // Command to open MCP setup guide
    const openMcpSetupGuideCommand = vscode.commands.registerCommand('etl-code.openMcpSetupGuide', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return;
        }

        const guidePath = path.join(workspaceFolder.uri.fsPath, 'BOB-MCP-MANUAL-SETUP.md');
        
        if (fs.existsSync(guidePath)) {
            const doc = await vscode.workspace.openTextDocument(guidePath);
            await vscode.window.showTextDocument(doc, { preview: false });
        } else {
            vscode.window.showErrorMessage('Setup guide not found: BOB-MCP-MANUAL-SETUP.md');
        }
    });

    // Command to toggle MCP server
    const toggleMcpServerCommand = vscode.commands.registerCommand('etl-code.toggleMcpServer', async () => {
        await mcpManager.toggleServer();
    });

    // Command to restart MCP server
    const restartMcpServerCommand = vscode.commands.registerCommand('etl-code.restartMcpServer', async () => {
        await mcpManager.stopServer();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await mcpManager.startServer();
    });

    // Command to show MCP configuration for Bob
    const showMcpConfigCommand = vscode.commands.registerCommand('etl-code.showMcpConfig', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return;
        }

        const serverPath = path.join(workspaceFolder.uri.fsPath, 'dist', 'mcp', 'server-entry.js');
        
        const config = {
            mcpServers: {
                'etl-code': {
                    command: 'node',
                    args: [serverPath],
                    env: {},
                    disabled: false,
                    description: 'ETL Code MCP Server - Provides AI tools for ETL pipeline execution'
                }
            }
        };

        const configJson = JSON.stringify(config, null, 2);

        const action = await vscode.window.showInformationMessage(
            'MCP Server Configuration for Bob/Cline',
            'Copy to Clipboard',
            'Show in Editor',
            'Cancel'
        );

        if (action === 'Copy to Clipboard') {
            await vscode.env.clipboard.writeText(configJson);
            vscode.window.showInformationMessage(
                '✅ Configuration copied! Paste it in Bob Settings → MCP Servers'
            );
        } else if (action === 'Show in Editor') {
            const instructions = `# MCP Server Configuration for Bob/Cline

## How to Add This Server to Bob/Cline:

1. Open Bob/Cline settings (click the gear icon in Bob's interface)
2. Navigate to "MCP Servers" section
3. Add the following configuration:

\`\`\`json
${configJson}
\`\`\`

4. Save and restart Bob/Cline or reload VSCode

## Server Status

- The MCP server is managed by this extension
- Check the status bar (bottom right) for server status
- Use "ETL: Toggle MCP Server" command to start/stop

## Available Tools

Once configured, Bob/Cline will have access to:
- \`execute_etl_pipeline\` - Execute ETL pipelines with CSV data
- \`preview_database_schema\` - Preview database schemas for mapping

## Troubleshooting

If Bob doesn't detect the server:
1. Ensure the server is running (check status bar)
2. Verify the path in the configuration is correct
3. Restart Bob/Cline extension
4. Check Bob's logs for connection errors
`;

            const doc = await vscode.workspace.openTextDocument({
                content: instructions,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }
    });

    context.subscriptions.push(
        sidebarRegistration,
        detailsRegistration,
        canvasCommand,
        helloWorldCommand,
        configureMcpCommand,
        openMcpSetupGuideCommand,
        toggleMcpServerCommand,
        restartMcpServerCommand,
        showMcpConfigCommand,
        mcpManager
    );
}

export function deactivate() {
    console.log('ETL Code extension is being deactivated');
    // MCP Manager will be disposed automatically via context.subscriptions
}
