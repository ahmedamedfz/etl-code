# 🚀 MCP Auto-Start Quick Guide

The ETL Code extension now **automatically starts the MCP server** when you open VSCode!

## ✨ What's New

- **Auto-Start**: MCP server starts automatically with the extension
- **Status Bar**: Real-time server status indicator (bottom right)
- **One-Click Control**: Click status bar to toggle server on/off
- **Auto-Configuration**: Automatically updates Bob/Cline settings
- **Zero Setup**: No manual configuration needed

## 📊 Status Bar Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| `$(debug-stop) MCP: Stopped` | Stopped | Click to start |
| `$(loading~spin) MCP: Starting...` | Starting | Please wait |
| `$(check) MCP: Running` | Running | Ready to use! |
| `$(error) MCP: Error` | Error | Click to retry |

## 🎯 Quick Start

1. **Open VSCode** with the extension installed
2. **Look at status bar** (bottom right) - server starts automatically
3. **Wait for** `$(check) MCP: Running` status
4. **Use Bob/Cline** - MCP tools are ready!

## 🎮 Commands

- **Toggle Server**: Click status bar or use `ETL: Toggle MCP Server`
- **Restart Server**: Use `ETL: Restart MCP Server` command
- **View Docs**: Use `ETL: Open MCP Setup Guide` command

## ⚙️ First Time Setup

If this is your first time:

1. **Compile the project**:
   ```bash
   pnpm run compile
   ```
2. **Reload VSCode** - server will auto-start
3. **Done!** Check the status bar

## 🔧 Troubleshooting

### Server shows "Error"
- Run `pnpm run compile`
- Check if `dist/mcp/server-entry.js` exists
- Restart VSCode

### Bob can't see tools
- Check `.bob/mcp.json` exists
- Restart Bob/Cline extension
- Verify server status is "Running"

## 📚 Full Documentation

For detailed information, see [MCP-AUTO-START.md](./MCP-AUTO-START.md)

## 🎉 Benefits

- ✅ No manual server startup
- ✅ No configuration file editing
- ✅ Visual status feedback
- ✅ Automatic cleanup
- ✅ Error handling built-in
- ✅ Works everywhere the extension is installed

---

**That's it! The MCP server is now part of your extension and works automatically.** 🎊