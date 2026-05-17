# MCP Server Quick Start Guide

## Two Easy Ways to Configure MCP Server in Bob

### Option 1: Using the Sidebar (Recommended)

1. **Press F5** to start the Extension Development Host
2. **Open the ETL Tools sidebar** (click the ETL icon in the activity bar)
3. At the top of the sidebar, you'll see **"AI Assistant Setup"** section with two buttons:
   - **"Configure MCP Server"** - Click this to get step-by-step instructions
   - **"Setup Guide"** - Opens the detailed manual setup guide

4. Click **"Configure MCP Server"** and follow the prompts:
   - It will check if the server is compiled
   - Click "Copy Config" to copy the configuration to clipboard
   - Open Bob Settings and paste the configuration

### Option 2: Using Command Palette

1. **Press F5** to start the Extension Development Host
2. **Open Command Palette** (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Type and select one of these commands:
   - **"ETL: Configure MCP Server in Bob"** - Interactive configuration helper
   - **"ETL: Open MCP Setup Guide"** - Opens the detailed guide

## What the Commands Do

### "Configure MCP Server in Bob"
- Checks if the MCP server is compiled
- Offers to compile if needed
- Provides the exact configuration to paste in Bob's settings
- Copies configuration to clipboard with one click
- Guides you to Bob's settings

### "Open MCP Setup Guide"
- Opens `BOB-MCP-MANUAL-SETUP.md` with detailed instructions
- Includes troubleshooting tips
- Shows alternative configuration methods

## Configuration That Gets Copied

When you click "Copy Config", this is what gets copied to your clipboard:

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

## Where to Paste It

1. In the **Extension Development Host** window (not the main window)
2. Open **Bob Settings** (click Bob's gear icon)
3. Navigate to **"MCP Servers"** section
4. Paste the configuration
5. Save and restart Bob

## Verification

After configuration, you should see in Bob:
- ✅ "etl-code" server listed
- ✅ Status: Connected/Running
- ✅ Two available tools:
  - `execute_etl_pipeline`
  - `preview_database_schema`

## Troubleshooting

### "MCP server file not found"
- Click "Compile Now" when prompted
- Or run manually: `pnpm run compile`

### "No workspace folder found"
- Make sure you have a workspace open in VSCode
- The extension needs to know where the project is located

### Server not appearing in Bob
- Make sure you're configuring Bob in the **Extension Development Host**, not the main window
- Restart Bob after adding the configuration
- Check that the file path is correct

## Need More Help?

- Click **"Setup Guide"** button in the sidebar
- Or open `BOB-MCP-MANUAL-SETUP.md` for detailed instructions
- Or check `MCP-SETUP.md` for technical details