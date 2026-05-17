# etl-code

`etl-code` is a VS Code extension for building ETL workflows visually and exposing the same workflow engine through an MCP server for AI assistants such as IBM Bob or Cline.

The extension provides:

- A React Flow ETL canvas opened with `ETL Code: Open ETL Canvas`.
- Activity bar views for node selection and node details.
- Workflow JSON import/export from the canvas.
- MCP resources for the semantic ETL contracts in `resources/`.
- MCP tools for workflow generation, validation, review, and execution.
- Automatic Bob and VS Code MCP configuration on activation.
- Local mock execution and PostgreSQL/Supabase execution paths.

## Requirements

- VS Code `^1.100.0`
- Node.js and `pnpm`
- Optional: IBM Bob, Cline, or another MCP-compatible assistant
- Optional: PostgreSQL/Supabase credentials for real database execution

Install dependencies:

```bash
pnpm install
```

Build the extension:

```bash
pnpm run compile
```

## Development

Run the extension in a VS Code Extension Development Host:

1. Open this repository in VS Code.
2. Run `pnpm install`.
3. Run `pnpm run compile`.
4. Press `F5`.
5. In the development host, run `ETL Code: Open ETL Canvas`.

Useful scripts:

```bash
pnpm run compile       # type-check, lint, build CSS, and bundle
pnpm run watch         # watch TypeScript, esbuild, and CSS
pnpm run check-types   # TypeScript only
pnpm run lint          # ESLint
pnpm run test          # VS Code test runner
pnpm run mcp:stdio     # start MCP over stdio
pnpm run mcp:http      # start MCP over HTTP/SSE on port 3001
```

## Workflow JSON

The canvas exports version-1 workflow documents:

```json
{
  "version": 1,
  "format": "full",
  "nodes": [],
  "edges": []
}
```

Use `Export Workflow JSON` for full React Flow-compatible data and `Export Prompt (MCP)` for a trimmed prompt-oriented document. Use `Import Workflow JSON` to paste or load a workflow back into the canvas.

## MCP Server

The MCP server is implemented in `src/mcp/MCPServer.ts` and started by `src/mcp/server-entry.ts`.

Transports:

- Stdio: `pnpm run mcp:stdio`
- HTTP/SSE: `pnpm run mcp:http`
- Custom HTTP/SSE port: `pnpm run mcp:http:custom 8080`

The extension also starts the HTTP/SSE server on port `3001` during activation.

See [MCP-SETUP.md](MCP-SETUP.md) and [MCP-AUTO-CONFIG.md](MCP-AUTO-CONFIG.md) for connection details.

## MCP Workflow Safety

Execution tools are intentionally review-gated. MCP clients should follow this order:

1. `get_etl_workflow_schema`
2. `generate_etl_workflow`
3. Show the generated workflow to the user.
4. `review_etl_workflow` with `userReviewed: true` and the user's approval text.
5. Execute with `execute_etl_pipeline` or `execute_etl_pipeline_postgres` using the returned `workflowReviewToken`.

## Semantic Resources

The compiler and MCP resources are driven by JSON contracts in `resources/`:

- `compiler-pipeline.json`
- `etl-graph-generator-specification.json`
- `node-catalog.json`
- `field-propagation-rules.json`
- `validation-rules.json`
- `prompt-templates.json`
- `example-patterns.json`

These resources are loaded through `src/semantic/ResourceRegistry.ts` and exposed through MCP resource URIs such as `etl://resources/node-catalog`.

## Key Source Areas

- `src/extension.ts` - VS Code activation, view registration, MCP auto-configuration.
- `src/CanvasPanel.ts` - ETL canvas webview host and workflow import/export bridge.
- `src/webview/` - React canvas, sidebar, details, node utilities, workflow serialization.
- `src/mcp/` - MCP server, workflow generation, server entrypoint, tool-flow logging.
- `src/compiler/` - compiler pipeline, validation, propagation, node factory, type utilities.
- `src/pipeline/` - execution engine and logging.
- `src/db/` - mock Oracle, SQLite, and PostgreSQL connectors.
- `src/semantic/` - semantic resource loading and registry.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).
