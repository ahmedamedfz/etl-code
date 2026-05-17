import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';

/**
 * MCPManager - Manages the lifecycle of the MCP server within the extension
 * 
 * This class handles:
 * - Auto-starting the MCP server when the extension activates
 * - Managing the server process lifecycle
 * - Updating Bob's MCP configuration automatically
 * - Providing status updates via status bar
 * - Graceful shutdown on extension deactivation
 */
export class MCPManager {
    private serverProcess?: ChildProcess;
    private statusBarItem: vscode.StatusBarItem;
    private extensionContext: vscode.ExtensionContext;
    private isServerRunning: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.extensionContext = context;
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'etl-code.toggleMcpServer';
        context.subscriptions.push(this.statusBarItem);
        
        this.updateStatusBar('stopped');
    }
    /**
     * Find the MCP server entry point
     * Checks multiple locations: extension path (packaged), workspace (development)
     */
    private findServerPath(): string | null {
        // 1. Check extension path (for packaged extension)
        const extensionPath = this.extensionContext.extensionPath;
        const extensionServerPath = path.join(extensionPath, 'dist', 'mcp', 'server-entry.js');
        
        if (fs.existsSync(extensionServerPath)) {
            console.log('[MCP Manager] Found server at extension path:', extensionServerPath);
            return extensionServerPath;
        }

        // 2. Check workspace folder (for development)
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const workspaceServerPath = path.join(workspaceFolder.uri.fsPath, 'dist', 'mcp', 'server-entry.js');
            if (fs.existsSync(workspaceServerPath)) {
                console.log('[MCP Manager] Found server at workspace path:', workspaceServerPath);
                return workspaceServerPath;
            }
        }

        console.error('[MCP Manager] Server not found in any location');
        return null;
    }

    /**
     * Start the MCP server automatically
     */
    public async startServer(): Promise<boolean> {
        if (this.isServerRunning) {
            vscode.window.showInformationMessage('MCP server is already running');
            return true;
        }

        // Try to find the server path - check extension path first (for packaged extension)
        const serverPath = this.findServerPath();
        
        if (!serverPath) {
            vscode.window.showWarningMessage(
                'MCP server not found. The extension needs to be compiled first.',
                'Learn More'
            ).then(action => {
                if (action === 'Learn More') {
                    vscode.commands.executeCommand('etl-code.showMcpConfig');
                }
            });
            this.updateStatusBar('stopped');
            return false;
        }

        try {
            this.updateStatusBar('starting');
            
            // Get working directory from server path
            const workingDir = path.dirname(path.dirname(path.dirname(serverPath))); // Go up from dist/mcp/server-entry.js to project root
            
            // Spawn the MCP server process
            this.serverProcess = spawn('node', [serverPath], {
                cwd: workingDir,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    NODE_ENV: 'production'
                }
            });

            // Handle server output
            this.serverProcess.stdout?.on('data', (data) => {
                console.log(`[MCP Server] ${data.toString()}`);
            });

            this.serverProcess.stderr?.on('data', (data) => {
                const message = data.toString();
                console.error(`[MCP Server] ${message}`);
                
                // Check for successful startup message
                if (message.includes('MCP Stdio Server running')) {
                    this.isServerRunning = true;
                    this.updateStatusBar('running');
                    this.updateBobConfiguration(serverPath);
                }
            });

            this.serverProcess.on('error', (error) => {
                console.error('[MCP Server] Process error:', error);
                this.isServerRunning = false;
                this.updateStatusBar('error');
                vscode.window.showErrorMessage(`MCP server error: ${error.message}`);
            });

            this.serverProcess.on('exit', (code, signal) => {
                console.log(`[MCP Server] Process exited with code ${code} and signal ${signal}`);
                this.isServerRunning = false;
                this.serverProcess = undefined;
                this.updateStatusBar('stopped');
            });

            // Wait a bit to ensure server starts
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (this.serverProcess && !this.serverProcess.killed) {
                this.isServerRunning = true;
                this.updateStatusBar('running');
                vscode.window.showInformationMessage('MCP server started successfully');
                return true;
            } else {
                throw new Error('Server process failed to start');
            }

        } catch (error: any) {
            console.error('[MCP Manager] Failed to start server:', error);
            this.updateStatusBar('error');
            vscode.window.showErrorMessage(`Failed to start MCP server: ${error.message}`);
            return false;
        }
    }

    /**
     * Stop the MCP server
     */
    public async stopServer(): Promise<void> {
        if (!this.serverProcess || !this.isServerRunning) {
            vscode.window.showInformationMessage('MCP server is not running');
            return;
        }

        this.updateStatusBar('stopping');

        try {
            // Send SIGTERM for graceful shutdown
            this.serverProcess.kill('SIGTERM');
            
            // Wait for process to exit
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    // Force kill if not stopped after 5 seconds
                    if (this.serverProcess && !this.serverProcess.killed) {
                        this.serverProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);

                this.serverProcess?.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            this.isServerRunning = false;
            this.serverProcess = undefined;
            this.updateStatusBar('stopped');
            vscode.window.showInformationMessage('MCP server stopped');

        } catch (error: any) {
            console.error('[MCP Manager] Error stopping server:', error);
            vscode.window.showErrorMessage(`Error stopping MCP server: ${error.message}`);
        }
    }

    /**
     * Toggle server on/off
     */
    public async toggleServer(): Promise<void> {
        if (this.isServerRunning) {
            await this.stopServer();
        } else {
            await this.startServer();
        }
    }

    /**
     * Update the status bar item
     */
    private updateStatusBar(status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'): void {
        const statusConfig = {
            stopped: {
                text: '$(debug-stop) MCP: Stopped',
                tooltip: 'Click to start MCP server',
                color: undefined
            },
            starting: {
                text: '$(loading~spin) MCP: Starting...',
                tooltip: 'MCP server is starting',
                color: new vscode.ThemeColor('statusBarItem.warningBackground')
            },
            running: {
                text: '$(check) MCP: Running',
                tooltip: 'Click to stop MCP server',
                color: new vscode.ThemeColor('statusBarItem.prominentBackground')
            },
            stopping: {
                text: '$(loading~spin) MCP: Stopping...',
                tooltip: 'MCP server is stopping',
                color: new vscode.ThemeColor('statusBarItem.warningBackground')
            },
            error: {
                text: '$(error) MCP: Error',
                tooltip: 'MCP server encountered an error. Click to retry.',
                color: new vscode.ThemeColor('statusBarItem.errorBackground')
            }
        };

        const config = statusConfig[status];
        this.statusBarItem.text = config.text;
        this.statusBarItem.tooltip = config.tooltip;
        this.statusBarItem.backgroundColor = config.color;
        this.statusBarItem.show();
    }

    /**
     * Compile the project
     */
    private async compileProject(workspacePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const terminal = vscode.window.createTerminal({
                name: 'ETL Compile',
                cwd: workspacePath
            });
            terminal.show();
            terminal.sendText('pnpm run compile');
            
            vscode.window.showInformationMessage(
                'Compiling project... Please wait for compilation to complete.',
                'OK'
            ).then(() => {
                // Wait a bit for compilation
                setTimeout(() => resolve(), 3000);
            });
        });
    }

    /**
     * Update Bob's MCP configuration automatically
     */
    private updateBobConfiguration(serverPath: string): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        // Create configuration for Bob
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

        try {
            // 1. Update .bob/mcp.json (workspace-specific)
            const bobConfigPath = path.join(workspaceFolder.uri.fsPath, '.bob', 'mcp.json');
            const bobDir = path.dirname(bobConfigPath);
            if (!fs.existsSync(bobDir)) {
                fs.mkdirSync(bobDir, { recursive: true });
            }
            fs.writeFileSync(bobConfigPath, JSON.stringify(config, null, 4));
            console.log('[MCP Manager] Updated Bob configuration at:', bobConfigPath);

            // 2. Show notification with instructions
            this.showBobSetupNotification(config);

        } catch (error) {
            console.error('[MCP Manager] Failed to update Bob configuration:', error);
        }
    }

    /**
     * Show notification to help user configure Bob
     */
    private async showBobSetupNotification(config: any): Promise<void> {
        const configJson = JSON.stringify(config, null, 2);
        
        const action = await vscode.window.showInformationMessage(
            '✅ MCP Server is running! To use it with Bob/Cline, add the server configuration.',
            'Copy Config',
            'Show Instructions',
            'Dismiss'
        );

        if (action === 'Copy Config') {
            await vscode.env.clipboard.writeText(configJson);
            vscode.window.showInformationMessage(
                '📋 Configuration copied! Open Bob Settings → MCP Servers and paste it.',
                'Got it'
            );
        } else if (action === 'Show Instructions') {
            const message = `
To add the MCP server to Bob/Cline:

1. Open Bob/Cline settings (click gear icon)
2. Find "MCP Servers" section
3. Add this configuration:

${configJson}

4. Restart Bob/Cline or reload VSCode

The server is already running and ready to use!
            `.trim();

            const doc = await vscode.workspace.openTextDocument({
                content: message,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }
    }

    /**
     * Get server status
     */
    public isRunning(): boolean {
        return this.isServerRunning;
    }

    /**
     * Cleanup on extension deactivation
     */
    public async dispose(): Promise<void> {
        if (this.isServerRunning) {
            await this.stopServer();
        }
        this.statusBarItem.dispose();
    }
}

// Made with Bob
