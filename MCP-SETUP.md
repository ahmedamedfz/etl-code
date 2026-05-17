# MCP Server Setup

This guide explains how to connect an MCP-compatible assistant to the ETL Code MCP server.

## Build First

```bash
pnpm run compile
```

The MCP entrypoint is generated at:

```text
dist/mcp/server-entry.js
```

## Stdio Transport

Use stdio for local MCP clients that launch the server process.

```bash
pnpm run mcp:stdio
```

Equivalent command:

```bash
node dist/mcp/server-entry.js
```

Example MCP configuration:

```json
{
  "mcpServers": {
    "etl-code": {
      "command": "node",
      "args": [
        "/absolute/path/to/etl-code/dist/mcp/server-entry.js"
      ],
      "env": {},
      "disabled": false
    }
  }
}
```

## HTTP/SSE Transport

Use HTTP/SSE for Bob or clients that connect to a running endpoint.

```bash
pnpm run mcp:http
```

Default endpoint:

```text
http://localhost:3001/sse
```

Custom port:

```bash
pnpm run mcp:http:custom 8080
```

Example MCP configuration:

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

## Automatic Extension Startup

When the VS Code extension activates, it:

- Starts the HTTP/SSE MCP server on port `3001`.
- Writes Bob HTTP/SSE MCP configuration files.
- Writes workspace VS Code MCP configuration files.
- Writes global VS Code `mcp.servers` configuration for the stdio server.

See [MCP-AUTO-CONFIG.md](MCP-AUTO-CONFIG.md).

## Resources

The server exposes these JSON resources:

- `etl://resources/compiler-pipeline`
- `etl://resources/node-catalog`
- `etl://resources/validation-rules`
- `etl://resources/propagation-rules`
- `etl://resources/graph-spec`
- `etl://resources/prompt-templates`
- `etl://resources/example-patterns`

## Tools

Workflow creation and review:

- `get_mcp_tool_schemas`
- `get_etl_workflow_schema`
- `generate_etl_workflow`
- `review_etl_workflow`
- `validate_graph`
- `compile_etl`
- `get_node_definition`

Execution and data access:

- `execute_etl_pipeline`
- `execute_etl_pipeline_postgres`
- `execute_etl_pipelines_postgres`
- `preview_database_schema`
- `test_postgres_connection`

## Required Execution Sequence

Execution is blocked until the workflow has been generated and explicitly reviewed in the same MCP session:

1. Call `get_etl_workflow_schema`.
2. Call `generate_etl_workflow`.
3. Show the returned workflow JSON to the user.
4. Ask whether the workflow is correct.
5. Call `review_etl_workflow` with:
   - `workflow`
   - `userReviewed: true`
   - `userResponse` containing the user's approval text
6. Call `execute_etl_pipeline` or `execute_etl_pipeline_postgres` with the returned `workflowReviewToken`.

## Tool Notes

`generate_etl_workflow` imports the generated workflow into the VS Code canvas when the extension is connected.

`execute_etl_pipeline` uses the built-in mock Oracle connector.

`execute_etl_pipeline_postgres` accepts explicit connection fields, credentials embedded in the description, or `SUPABASE_*` environment variables.

`execute_etl_pipelines_postgres` is an alias for clients that pluralize the tool name.

## Troubleshooting

If the server cannot start:

```bash
pnpm run compile
ls -la dist/mcp/server-entry.js
pnpm run mcp:stdio
```

If HTTP/SSE cannot bind to port `3001`, start a custom port:

```bash
pnpm run mcp:http:custom 3002
```

If execution is rejected, restart the MCP workflow sequence:

```text
get_etl_workflow_schema -> generate_etl_workflow -> user review -> review_etl_workflow -> execute
```
