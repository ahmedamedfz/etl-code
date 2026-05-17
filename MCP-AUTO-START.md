# MCP Auto-Start Feature

## Overview

The ETL Code extension now includes **automatic MCP server management**. The MCP server starts automatically when the extension activates and is managed throughout its lifecycle.

## Features

### 🚀 Auto-Start on Extension Activation
- The MCP server automatically starts when you open VSCode with the extension installed
- No manual configuration or terminal commands needed
- Automatic compilation check - prompts you to compile if needed

### 📊 Status Bar Integration
- Real-time status indicator in the VSCode status bar (bottom right)
- Visual feedback for server state:
  - `$(debug-stop) MCP: Stopped` - Server is not running
  - `$(loading~spin) MCP: Starting...` - Server is starting up
  - `$(check) MCP: Running` - Server is active and ready
  - `$(loading~spin) MCP: Stopping...` - Server is shutting down
  - `$(error) MCP: Error` - Server encountered an error

### 🎮 Easy Control
Click the status bar item to toggle the server on/off, or use commands:
- **ETL: Toggle MCP Server** - Start/stop the server
- **ETL: Restart MCP Server** - Restart the server

### 🔄 Automatic Configuration
- Automatically updates `.bob/mcp.json` with the correct server path
- No manual configuration file editing required
- Works seamlessly with Bob/Cline AI assistants

### 🛡️ Graceful Lifecycle Management
- Automatic cleanup on extension deactivation
- Proper process termination (SIGTERM with SIGKILL fallback)
- No orphaned processes left behind

## How It Works

### Architecture

```
┌─────────────────────────────────────┐
│   VSCode Extension Activation       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   MCPManager Initialization         │
│   - Creates status bar item         │
│   - Sets up process management      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Auto-Start MCP Server             │
│   1. Check if compiled              │
│   2. Spawn node process             │
│   3. Monitor stdout/stderr          │
│   4. Update status bar              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Update Bob Configuration          │
│   - Write .bob/mcp.json             │
│   - Set correct server path         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   MCP Server Running                │
│   - Stdio transport active          │
│   - Ready for AI assistant tools    │
└─────────────────────────────────────┘
```

### Process Management

The `MCPManager` class handles:

1. **Startup**
   - Validates server file exists
   - Spawns Node.js child process
   - Monitors process output for success/errors
   - Updates status bar in real-time

2. **Runtime**
   - Maintains process reference
   - Logs server output to console
   - Handles process errors gracefully

3. **Shutdown**
   - Sends SIGTERM for graceful shutdown
   - Waits up to 5 seconds
   - Forces SIGKILL if needed
   - Cleans up resources

## Usage

### First Time Setup

1. **Install the extension** (or press F5 to debug)
2. **Compile the project** if prompted:
   ```bash
   pnpm run compile
   ```
3. **The MCP server starts automatically** - look for the status bar item

### Daily Usage

- **Open VSCode** → MCP server starts automatically
- **Check status** → Look at the status bar (bottom right)
- **Toggle server** → Click the status bar item
- **Use with Bob/Cline** → Server is already configured and running

### Commands

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `ETL: Toggle MCP Server` - Start or stop the server
- `ETL: Restart MCP Server` - Restart the server (useful after code changes)
- `ETL: Configure MCP Server in Bob` - Manual configuration helper (legacy)
- `ETL: Open MCP Setup Guide` - View detailed setup documentation

## Configuration

### Automatic Configuration

The extension automatically creates/updates `.bob/mcp.json`:

```json
{
  "mcpServers": {
    "etl-code": {
      "command": "node",
      "args": ["/absolute/path/to/dist/mcp/server-entry.js"],
      "env": {},
      "disabled": false
    }
  }
}
```

### Manual Override

If you need to customize the configuration:

1. Edit `.bob/mcp.json` manually
2. The auto-start feature will still work
3. Your custom settings will be preserved

## Troubleshooting

### Server Won't Start

**Problem**: Status bar shows "Error" or "Stopped"

**Solutions**:
1. Check if project is compiled:
   ```bash
   pnpm run compile
   ```
2. Verify `dist/mcp/server-entry.js` exists
3. Check VSCode Output panel for error messages
4. Try restarting VSCode

### Server Starts But Bob Can't Connect

**Problem**: Server running but Bob doesn't see tools

**Solutions**:
1. Check `.bob/mcp.json` has correct path
2. Restart Bob/Cline extension
3. Check Bob's MCP server list in settings
4. Verify Bob is looking at the correct workspace

### Compilation Issues

**Problem**: "MCP server not compiled" message

**Solutions**:
1. Run compilation manually:
   ```bash
   pnpm run compile
   ```
2. Check for TypeScript errors:
   ```bash
   pnpm run check-types
   ```
3. Ensure all dependencies are installed:
   ```bash
   pnpm install
   ```

### Process Won't Stop

**Problem**: Server process remains after stopping

**Solutions**:
1. Use "Restart MCP Server" command
2. Restart VSCode
3. Manually kill process:
   ```bash
   # Find process
   ps aux | grep server-entry.js
   # Kill it
   kill -9 <PID>
   ```

## Development

### Testing the Auto-Start Feature

1. **Open the project** in VSCode
2. **Press F5** to start debugging
3. **Extension Development Host opens**
4. **Check status bar** - should show "MCP: Starting..." then "MCP: Running"
5. **Open Bob/Cline** in the Extension Development Host
6. **Verify tools** are available in Bob's MCP server list

### Debugging

Enable detailed logging:

```typescript
// In src/mcp/MCPManager.ts
// All console.log and console.error output goes to:
// - VSCode Debug Console (when debugging)
// - Extension Host Output panel (View → Output → Extension Host)
```

### Making Changes

After modifying MCP server code:

1. **Recompile**:
   ```bash
   pnpm run compile
   ```
2. **Restart server**:
   - Click status bar item twice (stop then start)
   - Or use "ETL: Restart MCP Server" command
3. **Test changes** with Bob/Cline

## Benefits Over Manual Setup

| Feature | Manual Setup | Auto-Start |
|---------|-------------|------------|
| Configuration | Manual editing | Automatic |
| Server Start | Terminal command | Automatic |
| Status Visibility | None | Status bar |
| Process Management | Manual | Automatic |
| Cleanup | Manual | Automatic |
| Error Handling | None | Built-in |
| User Experience | Complex | Simple |

## Technical Details

### Files Involved

- `src/mcp/MCPManager.ts` - Main manager class
- `src/extension.ts` - Integration point
- `src/mcp/MCPServer.ts` - MCP server implementation
- `src/mcp/server-entry.ts` - Server entry point
- `.bob/mcp.json` - Bob configuration (auto-generated)

### Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- Node.js `child_process` - Process spawning
- VSCode Extension API - Status bar, commands, lifecycle

### Environment

- **Node.js**: Uses system Node.js installation
- **Working Directory**: Workspace root
- **Stdio Mode**: Standard input/output for MCP protocol
- **Environment Variables**: Inherits from VSCode process

## Migration from Manual Setup

If you were using manual MCP server setup:

1. **Remove manual startup scripts** - no longer needed
2. **Keep `.bob/mcp.json`** - will be auto-updated
3. **Stop manual server processes** - extension handles it now
4. **Reload VSCode** - auto-start takes over

## Future Enhancements

Potential improvements:

- [ ] HTTP/SSE transport option in UI
- [ ] Server logs viewer panel
- [ ] Configuration UI for server settings
- [ ] Multiple server instances support
- [ ] Health check and auto-restart
- [ ] Performance metrics display

## Support

For issues or questions:

1. Check this documentation
2. Review console logs (View → Output → Extension Host)
3. Check `.bob/mcp.json` configuration
4. Verify compilation with `pnpm run compile`
5. Open an issue on the project repository

---

**Made with ❤️ for seamless AI-assisted ETL development**