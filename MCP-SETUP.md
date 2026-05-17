# MCP Server Setup Guide

This guide explains how to connect IBM Bob (Cline AI Assistant) to the ETL MCP server in this VSCode extension.

## Overview

The ETL MCP server provides AI assistants with tools to:
- Execute ETL pipelines with CSV data and AI-generated mappings
- Preview database schemas for mapping assistance

## Prerequisites

1. **Build the project** to compile TypeScript to JavaScript:
   ```bash
   pnpm run compile
   ```

2. **Ensure Cline extension is installed** in VSCode

## Connection Methods

### Method 1: Stdio Transport (Recommended for Local Development)

This is the standard way to connect MCP servers to AI assistants like Cline/Bob.

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

#### Manual Testing

You can test the MCP server manually:

```bash
# Run in stdio mode (for Cline connection)
pnpm run mcp:stdio

# The server will wait for MCP protocol messages on stdin
```

### Method 2: HTTP/SSE Transport (For Remote Access)

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

Execution is intentionally gated. Clients must use this sequence in the same MCP session:

1. Call `get_etl_workflow_schema`
2. Call `generate_etl_workflow`
3. Show the generated workflow to the user and receive explicit approval
4. Call `review_etl_workflow` with `workflow`, `userReviewed: true`, and the user's approval text in `userResponse`
5. Call `execute_etl_pipeline` or `execute_etl_pipeline_postgres` with the returned `workflowReviewToken`

**Parameters:**
- `csvContent` (string, required): The raw CSV data to process
- `tableName` (string, required): Target database table name
- `aiMappingJson` (string, required): JSON string containing AI-generated mapping logic
- `workflowReviewToken` (string, required): Token returned by `review_etl_workflow`

**Example Usage:**
```typescript
{
  "csvContent": "name,age,email\nJohn,30,john@example.com",
  "tableName": "users",
  "aiMappingJson": "{\"name\":\"name\",\"age\":\"user_age\",\"email\":\"email_address\"}",
  "workflowReviewToken": "<token from review_etl_workflow>"
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

### Server Not Connecting

1. **Verify the build**: Ensure `dist/mcp/server-entry.js` exists
   ```bash
   ls -la dist/mcp/server-entry.js
   ```

2. **Check compilation**: Run the compile command
   ```bash
   pnpm run compile
   ```

3. **Test manually**: Run the server in stdio mode and check for errors
   ```bash
   pnpm run mcp:stdio
   ```

### Cline Not Detecting the Server

1. **Restart VSCode** completely
2. **Check Cline logs** for MCP connection errors
3. **Verify the path** in the configuration matches your workspace
4. **Ensure node is in PATH**: Test with `node --version`

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
