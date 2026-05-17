# Implementation Guide

This project implements an ETL workflow builder as a VS Code extension plus an MCP server.

## Architecture

```text
VS Code extension
  -> React webviews
  -> workflow JSON
  -> compiler and validation
  -> execution engine
  -> database connectors

MCP client
  -> MCP server
  -> semantic resources
  -> workflow generation
  -> user review
  -> execution
```

## Extension Entry

`src/extension.ts` handles activation:

- Configures Bob and VS Code MCP settings.
- Starts the HTTP/SSE MCP server on port `3001`.
- Registers the node sidebar and node details webviews.
- Registers `etl-code.openCanvas`.
- Connects canvas node selection and updates to the details view.

## Webview Layer

Main files:

- `src/CanvasPanel.ts`
- `src/NodeSidebarProvider.ts`
- `src/NodeDetailsProvider.ts`
- `src/webview/App.tsx`
- `src/webview/components/canvas/EtlFlowCanvas.tsx`
- `src/webview/components/details/WorkflowActions.tsx`
- `src/webview/utils/workflowSerialization.ts`

The canvas uses React Flow and version-1 workflow JSON:

```json
{
  "version": 1,
  "format": "full",
  "nodes": [],
  "edges": []
}
```

The details panel can export full workflow JSON, export a prompt-friendly workflow, and import workflow JSON back into the canvas.

## Semantic Resources

Semantic contracts live in `resources/`:

- `compiler-pipeline.json`
- `etl-graph-generator-specification.json`
- `node-catalog.json`
- `field-propagation-rules.json`
- `validation-rules.json`
- `prompt-templates.json`
- `example-patterns.json`

`src/semantic/ResourceLoader.ts` reads the files. `src/semantic/ResourceRegistry.ts` provides cached accessors for the compiler, MCP server, validation engine, node factory, propagation engine, and type utilities.

## Compiler Layer

Main files:

- `src/compiler/pipeline/CompilerPipeline.ts`
- `src/compiler/ValidationEngine.ts`
- `src/compiler/engines/PropagationEngine.ts`
- `src/compiler/factories/NodeFactory.ts`
- `src/compiler/utils/IDGenerator.ts`
- `src/compiler/utils/TypeSystem.ts`
- `src/compiler/utils/ExpressionValidator.ts`

The compiler pipeline supports natural-language compilation into workflow graph data with semantic metadata. The validation engine checks graph, node, edge, type, expression, and config rules.

## MCP Server

Main files:

- `src/mcp/MCPServer.ts`
- `src/mcp/server-entry.ts`
- `src/mcp/WorkflowGenerator.ts`
- `src/mcp/WorkflowGeneratorV2.ts`
- `src/mcp/ToolFlowLogger.ts`

The server supports stdio and HTTP/SSE. It exposes semantic resources and tools for schema discovery, generation, review, validation, compilation, database preview, connection testing, and execution.

Start stdio:

```bash
pnpm run mcp:stdio
```

Start HTTP/SSE:

```bash
pnpm run mcp:http
```

## MCP Resources

Resource URIs:

- `etl://resources/compiler-pipeline`
- `etl://resources/node-catalog`
- `etl://resources/validation-rules`
- `etl://resources/propagation-rules`
- `etl://resources/graph-spec`
- `etl://resources/prompt-templates`
- `etl://resources/example-patterns`

## MCP Tools

- `get_mcp_tool_schemas`
- `get_etl_workflow_schema`
- `generate_etl_workflow`
- `review_etl_workflow`
- `validate_graph`
- `compile_etl`
- `get_node_definition`
- `preview_database_schema`
- `test_postgres_connection`
- `execute_etl_pipeline`
- `execute_etl_pipeline_postgres`
- `execute_etl_pipelines_postgres`

## Review-Gated Execution

The execute tools require a `workflowReviewToken`.

Required sequence:

```text
get_etl_workflow_schema
generate_etl_workflow
show workflow to user
review_etl_workflow
execute_etl_pipeline or execute_etl_pipeline_postgres
```

The server hashes generated workflows and only issues a review token for a workflow generated in the same MCP session. If a caller supplies a different workflow with the token, execution is blocked.

## Workflow Generation

`generate_etl_workflow` uses `WorkflowGenerator.ts` to build a React Flow-compatible workflow from natural language.

For API sources, `MCPServer.generateSchemaAwareWorkflow()` attempts to fetch the API schema with `SchemaFetcher.fetchRestApiSchema()` and uses the discovered fields. If schema fetch fails, it still returns a default workflow that the user must validate.

## Execution

`src/pipeline/ExecutionEngine.ts` runs ETL operations through database connectors:

- `src/db/OracleMockConnector.ts`
- `src/db/PostgresConnector.ts`
- `src/db/SqliteConnector.ts`

`execute_etl_pipeline` uses the mock Oracle connector. `execute_etl_pipeline_postgres` uses explicit credentials, credentials parsed from the natural-language description, or `SUPABASE_*` environment variables.

## Development Checklist

1. Update semantic JSON resources when node behavior or validation contracts change.
2. Update workflow serialization when the workflow document shape changes.
3. Update MCP schemas when tool arguments change.
4. Run `pnpm run compile`.
5. Test canvas import/export in the Extension Development Host.
6. Test MCP stdio or HTTP/SSE with the required review sequence.
