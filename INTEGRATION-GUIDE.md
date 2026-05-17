# Integration Guide

This guide describes how the current ETL Code pieces fit together and how to extend them safely.

## Main Integration Points

```text
resources/*.json
  -> ResourceRegistry
  -> compiler, validation, MCP resources, node factory

VS Code webviews
  -> workflowSerialization
  -> CanvasPanel
  -> workflow import/export

MCP client
  -> ETLMCPServer
  -> WorkflowGenerator
  -> CanvasPanel.importWorkflow
  -> review-gated execution
```

## Extension Activation

`src/extension.ts` is the integration root for VS Code:

- Calls `configureEtlCodeMcpServer()`.
- Updates global VS Code `mcp.servers`.
- Creates `NodeSidebarProvider` and `NodeDetailsProvider`.
- Wires `CanvasPanel` selection/update events into the details view.
- Starts `ETLMCPServer.startHttp(3001)`.

When adding activation work, keep it idempotent because activation may run repeatedly in development.

## Adding or Updating Nodes

1. Update `resources/node-catalog.json`.
2. Update field propagation in `resources/field-propagation-rules.json` if the node changes fields.
3. Update validation in `resources/validation-rules.json` if the node has new constraints.
4. Update webview node metadata in `src/webview/utils/nodeConfigMeta.ts` if the UI needs new controls.
5. Update workflow generation in `src/mcp/WorkflowGenerator.ts` if natural-language generation should create the node.
6. Run `pnpm run compile`.

Prefer adding behavior through semantic resources first, then code only where runtime behavior is required.

## Updating Workflow JSON

Workflow JSON is serialized in `src/webview/utils/workflowSerialization.ts`.

If the document shape changes:

- Update `WorkflowDocument`.
- Update `serializeFullWorkflow()`.
- Update `serializePromptWorkflow()`.
- Update import normalization.
- Update `MCPServer.getWorkflowJsonSchema()`.
- Update README and MCP docs.

Current required shape:

```json
{
  "version": 1,
  "format": "full",
  "nodes": [],
  "edges": []
}
```

## Updating MCP Tools

Tool definitions and handlers live in `src/mcp/MCPServer.ts`.

When changing a tool:

1. Update the `ListToolsRequestSchema` tool definition.
2. Update the handler in `CallToolRequestSchema`.
3. Update `getMcpToolSchemas()` if the tool participates in schema discovery.
4. Keep execution tools behind the workflow-review gate unless the product requirement explicitly changes.
5. Update [MCP-SETUP.md](MCP-SETUP.md).

## Required MCP Workflow

MCP clients must use this sequence for execution:

```text
get_etl_workflow_schema
generate_etl_workflow
review_etl_workflow
execute_etl_pipeline or execute_etl_pipeline_postgres
```

Clients should show the generated workflow to the user before calling `review_etl_workflow`.

## PostgreSQL/Supabase Integration

`execute_etl_pipeline_postgres` can resolve connection data from:

- Direct tool arguments: `host`, `port`, `database`, `user`, `password`.
- Natural language in `description` or `prompt`.
- Environment variables:
  - `SUPABASE_HOST`
  - `SUPABASE_PORT`
  - `SUPABASE_DB`
  - `SUPABASE_USER`
  - `SUPABASE_PASSWORD`

Use `test_postgres_connection` before execution when troubleshooting credentials.

## API Source Integration

When a generated workflow description contains an API URL, `MCPServer.generateSchemaAwareWorkflow()` calls `SchemaFetcher.fetchRestApiSchema()` and passes discovered fields into `generateWorkflowFromDescription()`.

If schema fetch fails, a default workflow is generated with a note embedded in the description path. The workflow still requires user review before execution.

## Auto-Configuration Integration

MCP config helpers are in `src/utils/mcpConfig.ts`.

They currently write:

- Bob global settings.
- Bob global MCP JSON.
- Workspace Bob MCP JSON.
- Workspace VS Code MCP settings.
- Workspace VS Code MCP JSON.

If another client needs auto-configuration, add a focused helper that preserves existing config entries and updates only the ETL Code server entry.

## Verification Checklist

After integration changes:

```bash
pnpm run compile
pnpm run test
pnpm run mcp:stdio
```

Then test in the Extension Development Host:

1. Open the ETL Canvas.
2. Add or import a workflow.
3. Export full workflow JSON.
4. Export MCP prompt workflow.
5. Generate a workflow through MCP and confirm it imports to the canvas.
