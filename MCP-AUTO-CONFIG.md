# MCP Auto-Configuration

The extension configures ETL Code MCP connections automatically when it activates.

## What Activation Does

`src/extension.ts` calls `configureEtlCodeMcpServer()` and refreshes MCP configuration for Bob and VS Code. The operation is idempotent, so repeated activation repairs missing, empty, or stale config files.

It writes HTTP/SSE config for Bob and stdio config for VS Code, then starts the MCP HTTP/SSE server on port `3001`.

## Files Written

Bob HTTP/SSE config:

```text
~/.bob/settings/mcp_settings.json
~/.bob/mcp.json
<workspace>/.bob/mcp.json
```

VS Code stdio config:

```text
<workspace>/.vscode/mcp-settings.json
<workspace>/.vscode/mcp.json
```

Global VS Code setting:

```text
mcp.servers.etl-code
```

## Bob Server Entry

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

## VS Code Stdio Entry

```json
{
  "mcpServers": {
    "etl-code": {
      "command": "node",
      "args": [
        "<extension>/dist/mcp/server-entry.js"
      ],
      "env": {},
      "disabled": false
    }
  }
}
```

For `.vscode/mcp.json`, the server is written under `servers` with `type: "stdio"`.

## Runtime Behavior

On activation, the extension:

1. Resolves the extension path and workspace path.
2. Updates Bob and VS Code MCP config files.
3. Updates the global VS Code `mcp.servers` setting.
4. Starts `ETLMCPServer.startHttp(3001)`.
5. Shows a VS Code notification with the configured SSE endpoint.

## Manual Testing

Build first:

```bash
pnpm run compile
```

Run stdio:

```bash
pnpm run mcp:stdio
```

Run HTTP/SSE:

```bash
pnpm run mcp:http
```

Verify files:

```bash
cat ~/.bob/settings/mcp_settings.json
cat ~/.bob/mcp.json
cat .vscode/mcp-settings.json
cat .vscode/mcp.json
```

## Troubleshooting

If configuration fails:

- Check write permissions for `~/.bob`, `<workspace>/.bob`, and `<workspace>/.vscode`.
- Rebuild with `pnpm run compile`.
- Restart the Extension Development Host.

If Bob cannot connect:

- Confirm the extension is active.
- Confirm the endpoint is `http://localhost:3001/sse`.
- Check whether port `3001` is already in use.
- Restart Bob after the config files are refreshed.

If VS Code MCP cannot launch stdio:

- Confirm `dist/mcp/server-entry.js` exists.
- Confirm the configured path points to the active extension or workspace build.

## Code Reference

- `src/utils/mcpConfig.ts`
- `src/extension.ts`
- `src/mcp/MCPServer.ts`
- `src/mcp/server-entry.ts`
