# VS Code Extension Quickstart

This project is a VS Code extension named `etl-code`.

## First Run

```bash
pnpm install
pnpm run compile
```

Then press `F5` in VS Code to open an Extension Development Host.

In the development host:

1. Open the command palette.
2. Run `ETL Code: Open ETL Canvas`.
3. Use the `ETL Tools` activity bar container to browse nodes and inspect node details.

## Commands and Views

Commands contributed by `package.json`:

- `etl-code.openCanvas` - opens the ETL Canvas.
- `etl-code.helloWorld` - sample command retained from the extension scaffold.

Views contributed by `package.json`:

- `etl-code.nodeSidebar` - node palette.
- `etl-code.nodeDetails` - selected node details and workflow actions.

## Common Development Commands

```bash
pnpm run compile
pnpm run watch
pnpm run check-types
pnpm run lint
pnpm run test
```

## MCP Development

Build before running the MCP server:

```bash
pnpm run compile
```

Start stdio mode:

```bash
pnpm run mcp:stdio
```

Start HTTP/SSE mode:

```bash
pnpm run mcp:http
```

Start HTTP/SSE on a custom port:

```bash
pnpm run mcp:http:custom 8080
```

The extension starts the HTTP/SSE MCP server on port `3001` when activated.

## Testing in VS Code

Run `pnpm run compile` first. Then use the VS Code test runner or run:

```bash
pnpm run test
```

Tests live under `src/test/`.
