# Changelog

All notable changes to the `etl-code` VS Code extension are documented here.

## Unreleased

- Added a React Flow ETL canvas with source, transformer, target, and system node support.
- Added activity bar webviews for node browsing and selected node details.
- Added workflow JSON import/export and MCP prompt export from the canvas.
- Added an MCP server with stdio and HTTP/SSE transports.
- Added MCP semantic resources backed by JSON files in `resources/`.
- Added workflow generation, validation, review, schema, and execution MCP tools.
- Added review-gated execution with `workflowReviewToken` enforcement.
- Added mock Oracle execution and PostgreSQL/Supabase execution support.
- Added automatic Bob and VS Code MCP configuration on extension activation.
- Added schema-aware API workflow generation when a source URL is present.
- Added compiler utilities for validation, field propagation, node creation, IDs, type checks, and expression validation.
