#!/usr/bin/env node

/**
 * MCP Server Entry Point
 * 
 * This file serves as the entry point for the ETL MCP server.
 * It can be run in two modes:
 * 1. Stdio mode (default) - for local AI assistant connections
 * 2. HTTP/SSE mode - for remote connections
 * 
 * Usage:
 *   node dist/mcp/server-entry.js           # Stdio mode
 *   node dist/mcp/server-entry.js --http    # HTTP mode on port 3001
 *   node dist/mcp/server-entry.js --http --port 8080  # HTTP mode on custom port
 */

import { ETLMCPServer } from './MCPServer.js';

async function main() {
    const args = process.argv.slice(2);
    const useHttp = args.includes('--http');
    const portIndex = args.indexOf('--port');
    const port = portIndex !== -1 && args[portIndex + 1] 
        ? parseInt(args[portIndex + 1], 10) 
        : 3001;

    const server = new ETLMCPServer();

    if (useHttp) {
        console.error(`Starting ETL MCP Server in HTTP/SSE mode on port ${port}...`);
        await server.startHttp(port);
    } else {
        console.error('Starting ETL MCP Server in Stdio mode...');
        await server.startStdio();
    }
}

main().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});

// Made with Bob
