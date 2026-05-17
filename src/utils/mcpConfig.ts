import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

/**
 * Ensure the Bob settings directory exists
 */
export function ensureBobSettingsDir(): void {
    const settingsDir = getBobSettingsDir();
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }
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
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        console.log(`MCP settings written to: ${settingsPath}`);
    } catch (error) {
        console.error('Failed to write MCP settings:', error);
        throw error;
    }
}

/**
 * Configure the ETL Code MCP server in Bob's global settings
 * This adds or updates the etl-code-http server configuration
 */
export function configureEtlCodeMcpServer(port: number = 3001): void {
    const settings = readMcpSettings();
    
    // Add or update the etl-code-http server
    settings.mcpServers = settings.mcpServers || {};
    settings.mcpServers['etl-code-http'] = {
        url: `http://localhost:${port}/sse`,
        transport: 'sse'
    };
    
    writeMcpSettings(settings);
}

/**
 * Check if ETL Code MCP server is already configured
 */
export function isEtlCodeMcpConfigured(): boolean {
    const settings = readMcpSettings();
    return settings.mcpServers && 'etl-code-http' in settings.mcpServers;
}

/**
 * Remove ETL Code MCP server from configuration
 */
export function removeEtlCodeMcpServer(): void {
    const settings = readMcpSettings();
    
    if (settings.mcpServers && 'etl-code-http' in settings.mcpServers) {
        delete settings.mcpServers['etl-code-http'];
        writeMcpSettings(settings);
        console.log('ETL Code MCP server removed from configuration');
    }
}

// Made with Bob
