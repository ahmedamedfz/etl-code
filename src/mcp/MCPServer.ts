import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";

import { ExecutionEngine } from "../pipeline/ExecutionEngine";
import { OracleMockConnector } from "../db/OracleMockConnector";
import { PostgresConnector } from "../db/PostgresConnector";
import { generateWorkflowFromDescription } from "./WorkflowGenerator";
import { ResourceRegistry } from "../semantic/ResourceRegistry";
import { CompilerPipeline } from "../compiler/pipeline/CompilerPipeline";
import { ValidationEngine } from "../compiler/ValidationEngine";

export class ETLMCPServer {
    private server: Server;
    private engine: ExecutionEngine;
    private registry: ResourceRegistry;
    private compiler: CompilerPipeline;
    private validator: ValidationEngine;

    constructor() {
        this.engine = new ExecutionEngine();
        this.registry = ResourceRegistry.getInstance();
        this.compiler = new CompilerPipeline();
        this.validator = new ValidationEngine();
        
        this.server = new Server(
            {
                name: "etl-code-mcp-server",
                version: "1.0.0"
            },
            {
                capabilities: {
                    tools: {},
                    resources: {}
                }
            }
        );

        this.setupHandlers();
    }

    async initialize() {
        await this.registry.initialize();
    }

    private setupHandlers() {
        // ── Resource Handlers ────────────────────────────────────────────────────
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return {
                resources: [
                    {
                        uri: "etl://resources/compiler-pipeline",
                        name: "Compiler Pipeline Specification",
                        description: "6-stage ETL compiler pipeline definition",
                        mimeType: "application/json"
                    },
                    {
                        uri: "etl://resources/node-catalog",
                        name: "Node Catalog",
                        description: "Complete catalog of ETL node types (source, transformer, target, system)",
                        mimeType: "application/json"
                    },
                    {
                        uri: "etl://resources/validation-rules",
                        name: "Validation Rules",
                        description: "Graph validation rules for DAG, nodes, edges, types, expressions",
                        mimeType: "application/json"
                    },
                    {
                        uri: "etl://resources/propagation-rules",
                        name: "Field Propagation Rules",
                        description: "Rules for field propagation through transformers",
                        mimeType: "application/json"
                    },
                    {
                        uri: "etl://resources/graph-spec",
                        name: "Graph Specification",
                        description: "ETL graph generator specification with type system and conventions",
                        mimeType: "application/json"
                    },
                    {
                        uri: "etl://resources/prompt-templates",
                        name: "Prompt Templates",
                        description: "AI prompt templates for ETL compilation",
                        mimeType: "application/json"
                    },
                    {
                        uri: "etl://resources/example-patterns",
                        name: "Example Patterns",
                        description: "Example ETL patterns and workflows",
                        mimeType: "application/json"
                    }
                ]
            };
        });

        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const uri = request.params.uri;
            
            try {
                let content: any;
                
                switch (uri) {
                    case "etl://resources/compiler-pipeline":
                        content = this.registry.getCompilerPipeline();
                        break;
                    case "etl://resources/node-catalog":
                        content = this.registry.getNodeCatalog();
                        break;
                    case "etl://resources/validation-rules":
                        content = this.registry.getValidationRules();
                        break;
                    case "etl://resources/propagation-rules":
                        content = this.registry.getPropagationRules();
                        break;
                    case "etl://resources/graph-spec":
                        content = this.registry.getGraphSpec();
                        break;
                    case "etl://resources/prompt-templates":
                        content = this.registry.getPromptTemplates();
                        break;
                    case "etl://resources/example-patterns":
                        content = this.registry.getExamplePatterns();
                        break;
                    default:
                        throw new Error(`Unknown resource: ${uri}`);
                }

                return {
                    contents: [{
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify(content, null, 2)
                    }]
                };
            } catch (error: any) {
                throw new Error(`Failed to read resource ${uri}: ${error.message}`);
            }
        });

        // ── Tool Handlers ────────────────────────────────────────────────────────
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "execute_etl_pipeline",
                        description: "Executes the ETL pipeline using the built-in mock Oracle connector",
                        inputSchema: {
                            type: "object",
                            properties: {
                                csvContent:   { type: "string", description: "The raw CSV data" },
                                tableName:    { type: "string", description: "Target database table" },
                                aiMappingJson:{ type: "string", description: "JSON string of AI mapping logic" }
                            },
                            required: ["csvContent", "tableName", "aiMappingJson"]
                        }
                    },
                    {
                        name: "execute_etl_pipeline_postgres",
                        description: "Executes the ETL pipeline against a real PostgreSQL/Supabase database. " +
                                     "Connection is read from SUPABASE_* environment variables in .env. " +
                                     "Falls back to SQLite if the connection fails.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                csvContent:    { type: "string", description: "The raw CSV data" },
                                tableName:     { type: "string", description: "Target database table" },
                                aiMappingJson: { type: "string", description: "JSON string of AI mapping logic" },
                                host:     { type: "string", description: "Optional host override (defaults to SUPABASE_HOST env var)" },
                                port:     { type: "number", description: "Optional port override (defaults to SUPABASE_PORT env var)" },
                                database: { type: "string", description: "Optional database name override" },
                                user:     { type: "string", description: "Optional user override" }
                            },
                            required: ["csvContent", "tableName", "aiMappingJson"]
                        }
                    },
                    {
                        name: "preview_database_schema",
                        description: "Returns the curated mock Oracle schema (USERS + ORDERS tables with typed columns and preview rows)",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: "test_postgres_connection",
                        description: "Tests whether the PostgreSQL/Supabase connection is reachable using .env credentials",
                        inputSchema: {
                            type: "object",
                            properties: {
                                host:     { type: "string" },
                                port:     { type: "number" },
                                database: { type: "string" },
                                user:     { type: "string" }
                            },
                            required: []
                        }
                    },
                    {
                        name: "generate_etl_workflow",
                        description:
                            "Generates a complete ETL workflow JSON (React Flow graph) from a natural language description. " +
                            "The returned JSON is version-1 format with nodes (source, transformer, target, system) and edges. " +
                            "It can be loaded directly into the ETL canvas in the VS Code extension.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                description: {
                                    type: "string",
                                    description: "Natural language description of the ETL pipeline. " +
                                                 "Example: 'Load battery.csv, filter records before current time, convert humidity to real, save to SQLite battery_telemetry table'"
                                },
                                format: {
                                    type: "string",
                                    enum: ["full", "prompt"],
                                    description: "Output format. 'full' includes all metadata (default). 'prompt' is minimal for AI consumption."
                                }
                            },
                            required: ["description"]
                        }
                    },
                    {
                        name: "compile_etl",
                        description:
                            "Compile natural language to ETL workflow using the 6-stage compiler pipeline. " +
                            "Returns validated workflow with semantic metadata.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                naturalLanguage: {
                                    type: "string",
                                    description: "Natural language ETL description"
                                }
                            },
                            required: ["naturalLanguage"]
                        }
                    },
                    {
                        name: "validate_graph",
                        description:
                            "Validate an ETL workflow graph against all validation rules. " +
                            "Returns validation result with errors and warnings.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                workflow: {
                                    type: "object",
                                    description: "Workflow JSON to validate"
                                }
                            },
                            required: ["workflow"]
                        }
                    },
                    {
                        name: "get_node_definition",
                        description:
                            "Get node definition from catalog by type and subtype. " +
                            "Returns complete node specification including config schema and fields.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                nodeType: {
                                    type: "string",
                                    enum: ["source", "transformer", "target", "system"],
                                    description: "Node category"
                                },
                                subType: {
                                    type: "string",
                                    description: "Specific node type (e.g., 'csv', 'filter', 'sqlite')"
                                }
                            },
                            required: ["nodeType", "subType"]
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {

            // ── Tool: execute_etl_pipeline (mock DB) ─────────────────────────
            if (request.params.name === "execute_etl_pipeline") {
                const { csvContent, tableName, aiMappingJson } = request.params.arguments as any;
                try {
                    const aiMapping  = JSON.parse(aiMappingJson);
                    const connector  = new OracleMockConnector();
                    const result     = await this.engine.execute({ csvContent, tableName, dbConnector: connector, aiMapping });
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Pipeline Execution Failed: ${error.message}` }] };
                }
            }

            // ── Tool: execute_etl_pipeline_postgres (real Supabase/PG) ───────
            if (request.params.name === "execute_etl_pipeline_postgres") {
                const { csvContent, tableName, aiMappingJson, host, port, database, user } = request.params.arguments as any;
                
                const pgConfig = {
                    host:     host     || process.env.SUPABASE_HOST     || '',
                    port:     port     || Number(process.env.SUPABASE_PORT) || 5432,
                    database: database || process.env.SUPABASE_DB       || 'postgres',
                    user:     user     || process.env.SUPABASE_USER     || 'postgres',
                    password: process.env.SUPABASE_PASSWORD             || '',
                    sslMode:  'require' as const,
                    connectionTimeoutMillis: 8000,
                };

                if (!pgConfig.host) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: "No Postgres host configured. Set SUPABASE_HOST in .env or pass 'host' argument." }]
                    };
                }
                if (!pgConfig.password) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: "SUPABASE_PASSWORD is not set in .env. Fill in the password first." }]
                    };
                }

                try {
                    const aiMapping  = JSON.parse(aiMappingJson);
                    const connector  = new PostgresConnector(pgConfig);

                    // ── Auto-create battery_telemetry table if it doesn't exist ──
                    // This ensures IBM Bob never hits a "table missing" error even
                    // if the table was dropped or a new Supabase project is used.
                    if (tableName === 'battery_telemetry') {
                        await connector.query(`
                            CREATE TABLE IF NOT EXISTS battery_telemetry (
                                id                        SERIAL PRIMARY KEY,
                                device_id                 TEXT,
                                timestamp                 TIMESTAMPTZ,
                                battery_voltage_v         REAL,
                                battery_voltage_mv        INTEGER,
                                cell_1_voltage            REAL,
                                cell_2_voltage            REAL,
                                cell_3_voltage            REAL,
                                state_of_charge           REAL,
                                temperature_c             REAL,
                                temperature_f             REAL,
                                charge_current_a          REAL,
                                discharge_current_a       REAL,
                                cycle_count               INTEGER,
                                internal_resistance_mohm  REAL,
                                system_health_percentage  REAL,
                                state_flag                TEXT,
                                is_charging               BOOLEAN,
                                fault_code                TEXT,
                                humidity_percentage       REAL,
                                pressure_hpa              REAL,
                                created_at                TIMESTAMPTZ DEFAULT NOW()
                            )
                        `);
                    }

                    const result = await this.engine.execute({ csvContent, tableName, dbConnector: connector, aiMapping });
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                ...result,
                                dbBackend: `postgres://${pgConfig.user}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`
                            }, null, 2)
                        }]
                    };
                } catch (error: any) {
                    // Return a structured diagnostic — NOT a raw Postgres error string.
                    // Raw strings like "column X does not exist" cause IBM Bob to misdiagnose.
                    const pgCode    = error.code ?? 'unknown';
                    const pgDetail  = error.detail ?? '';
                    const diagnosis =
                        pgCode === '42P01' ? 'Table does not exist. Use CREATE TABLE first.' :
                        pgCode === '42703' ? `Column mismatch: ${error.message}. Check that targetField names in your mapping match actual table column names.` :
                        pgCode === '28P01' ? 'Authentication failed. Check SUPABASE_PASSWORD in .env.' :
                        pgCode === 'ENOTFOUND' ? 'Cannot reach database host. Check SUPABASE_HOST in .env.' :
                        error.message;

                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: diagnosis,
                                pgErrorCode: pgCode,
                                pgDetail: pgDetail,
                                hint: pgCode === '42703'
                                    ? 'Run generate_etl_workflow again to get the correct field names, then retry.'
                                    : 'Check .env credentials and table schema.'
                            }, null, 2)
                        }]
                    };
                }
            }

            // ── Tool: test_postgres_connection ───────────────────────────────
            if (request.params.name === "test_postgres_connection") {
                const args = request.params.arguments as any;
                const pgConfig = {
                    host:     args?.host     || process.env.SUPABASE_HOST || '',
                    port:     args?.port     || Number(process.env.SUPABASE_PORT) || 5432,
                    database: args?.database || process.env.SUPABASE_DB  || 'postgres',
                    user:     args?.user     || process.env.SUPABASE_USER || 'postgres',
                    password: process.env.SUPABASE_PASSWORD              || '',
                    sslMode:  'require' as const,
                    connectionTimeoutMillis: 5000,
                };

                const connector = new PostgresConnector(pgConfig);
                const ok = await connector.testConnection();
                try { await connector.disconnect(); } catch {}

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: ok,
                            host:    pgConfig.host,
                            port:    pgConfig.port,
                            database:pgConfig.database,
                            ssl:     'require',
                            message: ok ? 'Connection successful' : 'Connection failed — check host, port, and credentials'
                        }, null, 2)
                    }]
                };
            }

            // ── Tool: preview_database_schema ────────────────────────────────
            if (request.params.name === "preview_database_schema") {
                const connector = new OracleMockConnector();
                await connector.connect();
                const tables = connector.getAvailableTables();
                const schemasPayload = tables.map(t => {
                    const s = connector.getTableSchema(t)!;
                    return { tableName: s.tableName, columns: s.columns, previewRows: s.previewRows };
                });
                return { content: [{ type: "text", text: JSON.stringify(schemasPayload, null, 2) }] };
            }

            // ── Tool: generate_etl_workflow ───────────────────────────────────────────────
            if (request.params.name === "generate_etl_workflow") {
                const { description, format = 'full' } = request.params.arguments as any;
                try {
                    const workflow = generateWorkflowFromDescription(description, format);
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(workflow, null, 2)
                        }]
                    };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Workflow generation failed: ${error.message}` }] };
                }
            }

            // ── Tool: compile_etl ─────────────────────────────────────────────────────────
            if (request.params.name === "compile_etl") {
                const { naturalLanguage } = request.params.arguments as any;
                try {
                    const result = await this.compiler.compile(naturalLanguage);
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }]
                    };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Compilation failed: ${error.message}` }] };
                }
            }

            // ── Tool: validate_graph ──────────────────────────────────────────────────────
            if (request.params.name === "validate_graph") {
                const { workflow } = request.params.arguments as any;
                try {
                    const validation = await this.validator.validate(workflow);
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(validation, null, 2)
                        }]
                    };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Validation failed: ${error.message}` }] };
                }
            }

            // ── Tool: get_node_definition ─────────────────────────────────────────────────
            if (request.params.name === "get_node_definition") {
                const { nodeType, subType } = request.params.arguments as any;
                try {
                    const nodeDef = this.registry.getNodeDefinition(nodeType, subType);
                    if (!nodeDef) {
                        return {
                            isError: true,
                            content: [{ type: "text", text: `Node definition not found: ${nodeType}/${subType}` }]
                        };
                    }
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(nodeDef, null, 2)
                        }]
                    };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Failed to get node definition: ${error.message}` }] };
                }
            }

            throw new Error(`Tool not found: ${request.params.name}`);
        });
    }

    /**
     * Connects the MCP server to any transport (e.g. InMemoryTransport for testing).
     */
    public async connectTransport(transport: any) {
        await this.server.connect(transport);
    }

    public async startStdio() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log("MCP Stdio Server running...");
    }

    public async startHttp(port: number = 3001) {
        const app = express();
        app.use(cors());
        let transport: SSEServerTransport;
        app.get("/sse", async (req, res) => {
            transport = new SSEServerTransport("/message", res);
            await this.server.connect(transport);
        });
        app.post("/message", async (req, res) => {
            if (transport) { await transport.handlePostMessage(req, res); }
            else { res.status(503).send("Server not connected"); }
        });
        app.listen(port, () => { console.log(`MCP SSE Server listening on port ${port}`); });
    }
}
