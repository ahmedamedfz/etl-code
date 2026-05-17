# MCP Server Setup Guide

This guide explains how the ETL MCP server integrates with IBM Bob (Cline AI Assistant) in this VSCode extension.

## Overview

The ETL MCP server provides AI assistants with tools to:
- Execute ETL pipelines with CSV data and AI-generated mappings
- Preview database schemas for mapping assistance

## How It Works

**Bob/Cline automatically spawns the MCP server as a child process when it detects the configuration.**

When you press F5 to debug the extension:
1. The Extension Development Host window opens
2. Bob/Cline in that window reads `.bob/mcp.json` configuration
3. Bob/Cline spawns the MCP server as a separate process: `node dist/mcp/server-entry.js`
4. The server runs in stdio mode and communicates with Bob/Cline
5. When you close the Extension Development Host, Bob/Cline terminates the server process

## Prerequisites

1. **Build the project** to compile TypeScript to JavaScript:
   ```bash
   pnpm run compile
   ```

2. **Ensure Bob/Cline extension is installed** in VSCode

## Connection Methods

### Method 1: Stdio Transport (Automatic - Recommended)

The MCP server automatically starts in stdio mode when the extension runs.

#### Configuration

The MCP configuration is already set up in `.vscode/mcp-settings.json`:

```json
{
  "mcpServers": {
    "etl-code": {
      "command": "node",
      "args": [
        "${workspaceFolder}/dist/mcp/server-entry.js"
      ],
      "env": {},
      "disabled": false
    }
  }
}
```

#### Cline Configuration

To enable this MCP server in Cline:

1. **Open Cline Settings** in VSCode:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Cline: Open Settings"
   - Or click the settings icon in Cline's interface

2. **Add MCP Server Configuration**:
   - Navigate to the "MCP Servers" section
   - Add the following configuration:

   ```json
   {
     "etl-code": {
       "command": "node",
       "args": [
         "/Users/abunawas/Documents/etl-code/dist/mcp/server-entry.js"
       ]
     }
   }
   ```

   **Note**: Replace the path with your actual workspace path. You can use `${workspaceFolder}` if Cline supports it.

3. **Restart Cline/VSCode** to load the new MCP server

#### Manual Testing (Optional)

If you need to test the MCP server independently:

```bash
# Run in stdio mode (standalone)
pnpm run mcp:stdio

# The server will wait for MCP protocol messages on stdin
```

**Note:** When running the extension (F5), you don't need to manually start the server - it starts automatically!

### Method 2: HTTP/SSE Transport (For Remote Access - Manual Start Required)

If you need remote access or prefer HTTP transport:

#### Start the HTTP Server

```bash
# Start on default port 3001
pnpm run mcp:http

# Or start on a custom port
pnpm run mcp:http:custom 8080
```

#### Cline Configuration for HTTP

```json
{
  "etl-code": {
    "url": "http://localhost:3001/sse",
    "transport": "sse"
  }
}
```

## Available Tools

Once connected, Bob/Cline will have access to these MCP tools:

### 1. `execute_etl_pipeline`

Executes the ETL pipeline with CSV content and AI-generated mapping.

**Parameters:**
- `csvContent` (string, required): The raw CSV data to process
- `tableName` (string, required): Target database table name
- `aiMappingJson` (string, required): JSON string containing AI-generated mapping logic

**Example Usage:**
```typescript
{
  "csvContent": "name,age,email\nJohn,30,john@example.com",
  "tableName": "users",
  "aiMappingJson": "{\"name\":\"name\",\"age\":\"user_age\",\"email\":\"email_address\"}"
}
```

**Returns:**
- Success: Execution results with processed records
- Error: Error message with details

### 2. `preview_database_schema`

Gets the mock Oracle database schema for mapping assistance.

**Parameters:** None

**Returns:**
```json
[
  { "name": "user_id", "type": "number" },
  { "name": "name", "type": "string" },
  { "name": "user_age", "type": "number" },
  { "name": "email_address", "type": "string" }
]
```

## Troubleshooting

### Server Not Appearing in Extension Development Host

1. **Verify the build**: Ensure `dist/mcp/server-entry.js` exists
   ```bash
   ls -la dist/mcp/server-entry.js
   ```

2. **Check compilation**: Run the compile command
   ```bash
   pnpm run compile
   ```

3. **Verify `.bob/mcp.json` exists** in the workspace root with correct configuration

4. **Check the path**: Ensure `${workspaceFolder}/dist/mcp/server-entry.js` resolves correctly

### Bob/Cline Not Detecting the Server

1. **Open Extension Development Host** (press F5)
2. **Open Bob/Cline in the Extension Development Host window** (not the main window)
3. **Check Bob's MCP servers list** - look for "etl-code"
4. **Restart Bob/Cline** in the Extension Development Host if needed
5. **Check Bob's logs** for MCP connection errors

### Server Shows in Wrong Window

**Important**: The MCP server should appear in the **Extension Development Host** window, not the main VSCode window where you pressed F5.

- ✅ Correct: Bob/Cline in Extension Development Host sees "etl-code" MCP server
- ❌ Wrong: Bob/Cline in main VSCode window sees "etl-code" MCP server

If the server appears in the main window, Bob is reading the config from the wrong location. Ensure you're checking Bob in the Extension Development Host window.

### Permission Issues

If you get permission errors:

```bash
chmod +x dist/mcp/server-entry.js
```

## Architecture

```
┌─────────────────┐
│  IBM Bob/Cline  │
│  (AI Assistant) │
└────────┬────────┘
         │ MCP Protocol
         │
┌────────▼────────┐
│  Transport      │
│  - Stdio        │
│  - HTTP/SSE     │
└────────┬────────┘
         │
┌────────▼────────┐
│  ETLMCPServer   │
│  (server-entry) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───────────────┐
│ Tool │  │ Tool             │
│ #1   │  │ #2               │
└───┬──┘  └──┬───────────────┘
    │        │
    │        │
┌───▼────────▼──────────────┐
│  ExecutionEngine          │
│  Database Connectors      │
│  CSV Processing           │
└───────────────────────────┘
```

## Development

### Adding New Tools

To add new MCP tools, edit `src/mcp/MCPServer.ts`:

1. Add tool definition in `ListToolsRequestSchema` handler
2. Add tool implementation in `CallToolRequestSchema` handler
3. Rebuild the project: `pnpm run compile`
4. Restart the MCP server

### Debugging

Enable debug logging by setting environment variables:

```bash
DEBUG=mcp:* pnpm run mcp:stdio
```

## References

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Cline Extension](https://github.com/cline/cline)
- Project MCP Server: `src/mcp/MCPServer.ts`
- Server Entry Point: `src/mcp/server-entry.ts`