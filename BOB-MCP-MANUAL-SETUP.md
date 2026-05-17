# Manual MCP Server Setup in Bob (Extension Development Host)

Since Bob in the Extension Development Host doesn't automatically pick up the `.bob/mcp.json` file, you need to manually configure the MCP server in Bob's settings.

## Step-by-Step Instructions

### 1. Open Extension Development Host
Press **F5** in VSCode to start debugging your extension. This opens a new window (Extension Development Host).

### 2. Open Bob Settings in Extension Development Host
In the **Extension Development Host window**:
- Click on Bob's icon in the sidebar
- Click the **gear/settings icon** in Bob's interface
- Or use Command Palette: `Cmd+Shift+P` → "Bob: Open Settings"

### 3. Navigate to MCP Servers Section
In Bob's settings, find the **"MCP Servers"** section.

### 4. Add the ETL MCP Server Configuration

Click "Add MCP Server" or edit the JSON configuration directly and add:

```json
{
  "mcpServers": {
    "etl-code": {
      "command": "node",
      "args": [
        "/Users/ahmadfariz/Projects/github/etl-code/dist/mcp/server-entry.js"
      ],
      "env": {},
      "disabled": false
    }
  }
}
```

**Important**: Replace `/Users/ahmadfariz/Projects/github/etl-code` with your actual workspace path.

### 5. Alternative: Use Absolute Path

If `${workspaceFolder}` doesn't work, use the absolute path:

```json
{
  "mcpServers": {
    "etl-code": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/project/dist/mcp/server-entry.js"
      ]
    }
  }
}
```

### 6. Save and Restart Bob

After adding the configuration:
1. Save the settings
2. Restart Bob (close and reopen Bob's panel)
3. Or reload the Extension Development Host window

### 7. Verify the Server is Running

In Bob's interface, you should now see:
- "etl-code" in the MCP servers list
- Status: Connected/Running
- Available tools:
  - `execute_etl_pipeline`
  - `preview_database_schema`

## Troubleshooting

### "No MCP servers configured" Still Showing

1. **Check the path is correct**:
   ```bash
   ls -la /Users/ahmadfariz/Projects/github/etl-code/dist/mcp/server-entry.js
   ```

2. **Verify Node.js is accessible**:
   ```bash
   which node
   node --version
   ```

3. **Test the server manually**:
   ```bash
   cd /Users/ahmadfariz/Projects/github/etl-code
   node dist/mcp/server-entry.js
   ```
   It should start and wait for input (Ctrl+C to exit).

4. **Check Bob's logs**:
   - Look for error messages in Bob's output
   - Check the Extension Development Host's Debug Console

### Server Path Issues

If you're getting path errors, try these formats:

**Option 1: Absolute path**
```json
"args": ["/Users/ahmadfariz/Projects/github/etl-code/dist/mcp/server-entry.js"]
```

**Option 2: Relative to home**
```json
"args": ["~/Projects/github/etl-code/dist/mcp/server-entry.js"]
```

**Option 3: With workspace variable (if Bob supports it)**
```json
"args": ["${workspaceFolder}/dist/mcp/server-entry.js"]
```

### Permission Issues

If you get permission errors:
```bash
chmod +x /Users/ahmadfariz/Projects/github/etl-code/dist/mcp/server-entry.js
```

## Why Manual Configuration?

Bob's MCP server configuration is stored in Bob's own settings (usually in your user settings or workspace settings), not in the project's `.bob/mcp.json` file. When you open the Extension Development Host, it's a fresh VSCode instance that doesn't inherit Bob's configuration from the main window.

## Alternative: Global Bob Configuration

You can also add the MCP server to your **global Bob settings** (in your main VSCode instance), and it will be available in all workspaces including the Extension Development Host:

1. Open Bob settings in your **main VSCode window**
2. Add the etl-code MCP server configuration
3. This configuration will persist across all VSCode windows

However, you'll need to use an absolute path since `${workspaceFolder}` will vary.