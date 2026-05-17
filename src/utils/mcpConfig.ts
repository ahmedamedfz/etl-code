import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const BOB_HTTP_SERVER_NAME = 'etl-code-http';
const STDIO_SERVER_NAME = 'etl-code';

export interface McpConfigOptions {
    extensionPath?: string;
    workspacePath?: string;
}

interface McpConfigResult {
    path: string;
    type: 'bob-http' | 'vscode-stdio';
}

/**
 * Get the Bob global settings directory path
 * Bob stores its settings in ~/.bob/settings/
 */
export function getBobSettingsDir(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.bob', 'settings');
}

/**
 * Get the full path to mcp_settings.json
 */
export function getMcpSettingsPath(): string {
    return path.join(getBobSettingsDir(), 'mcp_settings.json');
}

export function getBobMcpJsonPath(): string {
    return path.join(os.homedir(), '.bob', 'mcp.json');
}

export function getWorkspaceBobMcpJsonPath(workspacePath: string): string {
    return path.join(workspacePath, '.bob', 'mcp.json');
}

export function getWorkspaceVsCodeMcpSettingsPath(workspacePath: string): string {
    return path.join(workspacePath, '.vscode', 'mcp-settings.json');
}

export function getWorkspaceVsCodeMcpJsonPath(workspacePath: string): string {
    return path.join(workspacePath, '.vscode', 'mcp.json');
}

/**
 * Ensure the Bob settings directory exists
 */
export function ensureBobSettingsDir(): void {
    const settingsDir = getBobSettingsDir();
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }
}

function ensureParentDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function readJsonFile(filePath: string): any {
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return content.trim() ? JSON.parse(content) : {};
        } catch (error) {
            console.error(`Failed to read MCP config at ${filePath}:`, error);
        }
    }

    return {};
}

function writeJsonFile(filePath: string, content: any): void {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    console.log(`MCP config written to: ${filePath}`);
}

/**
 * Read existing MCP settings or return empty config
 */
export function readMcpSettings(): any {
    const settingsPath = getMcpSettingsPath();
    
    if (fs.existsSync(settingsPath)) {
        try {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Failed to read MCP settings:', error);
            return { mcpServers: {} };
        }
    }
    
    return { mcpServers: {} };
}

/**
 * Write MCP settings to the global Bob configuration
 */
export function writeMcpSettings(settings: any): void {
    ensureBobSettingsDir();
    const settingsPath = getMcpSettingsPath();
    
    try {
        writeJsonFile(settingsPath, settings);
    } catch (error) {
        console.error('Failed to write MCP settings:', error);
        throw error;
    }
}

function upsertBobHttpConfig(filePath: string, port: number): McpConfigResult {
    const settings = readJsonFile(filePath);
    settings.mcpServers = settings.mcpServers || {};
    settings.mcpServers[BOB_HTTP_SERVER_NAME] = {
        url: `http://localhost:${port}/sse`,
        transport: 'sse'
    };

    writeJsonFile(filePath, settings);
    return { path: filePath, type: 'bob-http' };
}

function upsertVsCodeStdioConfig(filePath: string, extensionPath: string, useServersKey = false): McpConfigResult {
    const settings = readJsonFile(filePath);
    const serverEntryPath = path.join(extensionPath, 'dist', 'mcp', 'server-entry.js');
    const serverConfig = {
        command: 'node',
        args: [serverEntryPath],
        env: {},
        disabled: false
    };

    if (useServersKey) {
        settings.servers = settings.servers || {};
        settings.servers[STDIO_SERVER_NAME] = {
            type: 'stdio',
            command: serverConfig.command,
            args: serverConfig.args
        };
    } else {
        settings.mcpServers = settings.mcpServers || {};
        settings.mcpServers[STDIO_SERVER_NAME] = serverConfig;
    }

    writeJsonFile(filePath, settings);
    return { path: filePath, type: 'vscode-stdio' };
}

/**
 * Configure the ETL Code MCP server in Bob and VS Code MCP settings.
 * This is intentionally idempotent so activation can refresh stale or empty files.
 */
export function configureEtlCodeMcpServer(port: number = 3001, options: McpConfigOptions = {}): McpConfigResult[] {
    const configured: McpConfigResult[] = [];
    const extensionPath = options.extensionPath ?? process.cwd();
    const workspacePath = options.workspacePath ?? extensionPath;

    configured.push(upsertBobHttpConfig(getMcpSettingsPath(), port));
    configured.push(upsertBobHttpConfig(getBobMcpJsonPath(), port));
    configured.push(upsertBobHttpConfig(getWorkspaceBobMcpJsonPath(workspacePath), port));
    configured.push(upsertVsCodeStdioConfig(getWorkspaceVsCodeMcpSettingsPath(workspacePath), extensionPath));
    configured.push(upsertVsCodeStdioConfig(getWorkspaceVsCodeMcpJsonPath(workspacePath), extensionPath, true));

    return configured;
}

/**
 * Check if ETL Code MCP server is already configured
 */
export function isEtlCodeMcpConfigured(): boolean {
    const settings = readMcpSettings();
    return settings.mcpServers && BOB_HTTP_SERVER_NAME in settings.mcpServers;
}

/**
 * Remove ETL Code MCP server from configuration
 */
export function removeEtlCodeMcpServer(): void {
    const settings = readMcpSettings();
    
    if (settings.mcpServers && BOB_HTTP_SERVER_NAME in settings.mcpServers) {
        delete settings.mcpServers[BOB_HTTP_SERVER_NAME];
        writeMcpSettings(settings);
        console.log('ETL Code MCP server removed from configuration');
    }
}

// Made with Bob
