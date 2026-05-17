# MCP Auto-Configuration

This extension automatically configures the MCP (Model Context Protocol) server for IBM Bob when installed.

## What Happens on Installation

When you install and activate the ETL Code extension:

1. **Global MCP Configuration**: The extension automatically creates/updates the global MCP settings file at:
   ```
   ~/.bob/settings/mcp_settings.json
   ```

2. **Server Configuration**: It adds the following configuration:
   ```json
   {
     "mcpServers": {
       "etl-code-http": {
         "url": "http://localhost:3001/sse",
         "transport": "sse"
       }
     }
   }
   ```

3. **MCP Server Startup**: The MCP server automatically starts on port 3001 when the extension activates.

## Features

- ✅ **Automatic Configuration**: No manual setup required
- ✅ **Smart Detection**: Only configures if not already set up
- ✅ **User Notifications**: Shows success/error messages
- ✅ **Persistent Settings**: Configuration persists across VS Code restarts
- ✅ **Bob Integration**: Ready for IBM Bob to connect immediately

## Verification

After installing the extension, you can verify the configuration:

1. Check the global settings file:
   ```bash
   cat ~/.bob/settings/mcp_settings.json
   ```

2. Look for the success notification in VS Code:
   ```
   ETL Code MCP server configured at http://localhost:3001/sse
   ```

3. Check the VS Code Output panel (View → Output → ETL Code) for:
   ```
   MCP SSE Server listening on port 3001
   ```

## Manual Configuration (Optional)

If you need to manually configure or change the port:

```typescript
import { configureEtlCodeMcpServer } from './utils/mcpConfig';

// Configure with custom port
configureEtlCodeMcpServer(3002);
```

## Troubleshooting

### Configuration Failed

If you see "Failed to configure MCP settings":
- Check file permissions for `~/.bob/settings/`
- Ensure the directory is writable
- Try creating the directory manually: `mkdir -p ~/.bob/settings`

### Server Failed to Start

If the MCP server fails to start:
- Check if port 3001 is already in use
- Look for error messages in the VS Code Output panel
- Try restarting VS Code

### Bob Cannot Connect

If IBM Bob cannot connect to the MCP server:
1. Verify the configuration file exists: `~/.bob/settings/mcp_settings.json`
2. Check the server is running (look for "MCP SSE Server listening" in Output)
3. Ensure Bob is configured to read from `~/.bob/settings/mcp_settings.json`
4. Restart Bob after the extension is installed

## Uninstallation

When you uninstall the extension:
- The MCP server stops automatically
- The configuration in `~/.bob/settings/mcp_settings.json` remains
- To remove the configuration manually:
  ```bash
  # Edit the file and remove the "etl-code-http" entry
  nano ~/.bob/settings/mcp_settings.json
  ```

## Technical Details

### Configuration Location
- **macOS/Linux**: `~/.bob/settings/mcp_settings.json`
- **Windows**: `%USERPROFILE%\.bob\settings\mcp_settings.json`

### Server Details
- **Protocol**: SSE (Server-Sent Events)
- **Default Port**: 3001
- **Endpoint**: `/sse`
- **Message Endpoint**: `/message`

### Available Tools

The MCP server exposes the following tools to Bob:
- `execute_etl_pipeline` - Execute ETL with mock database
- `execute_etl_pipeline_postgres` - Execute ETL with PostgreSQL/Supabase
- `preview_database_schema` - View available database schemas
- `test_postgres_connection` - Test database connectivity
- `generate_etl_workflow` - Generate workflow from natural language

## Code Reference

The auto-configuration is implemented in:
- `src/utils/mcpConfig.ts` - Configuration utilities
- `src/extension.ts` - Activation logic
- `src/mcp/MCPServer.ts` - MCP server implementation