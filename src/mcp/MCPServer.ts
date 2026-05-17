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
import Papa from "papaparse";
import { createHash } from "crypto";

import { ExecutionEngine } from "../pipeline/ExecutionEngine";
import { OracleMockConnector } from "../db/OracleMockConnector";
import { PostgresConnector } from "../db/PostgresConnector";
import { WorkflowJSON, generateWorkflowFromDescription } from "./WorkflowGenerator";
import { ResourceRegistry } from "../semantic/ResourceRegistry";
import { CompilerPipeline } from "../compiler/pipeline/CompilerPipeline";
import { ValidationEngine } from "../compiler/ValidationEngine";
import { AIResponseSchema } from "../types";

export type WorkflowGeneratedHandler = (workflow: unknown) => void | Promise<void>;

export class ETLMCPServer {
    public readonly server: Server;
    private engine: ExecutionEngine;
    private registry: ResourceRegistry;
    private compiler: CompilerPipeline;
    private validator: ValidationEngine;

    constructor(private readonly onWorkflowGenerated?: WorkflowGeneratedHandler) {
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
                                aiMappingJson:{ type: "string", description: "JSON string of AI mapping logic" },
                                workflow: { type: "object", description: "Reviewed workflow JSON used to create workflowReviewToken" },
                                workflowReviewToken: { type: "string", description: "Token returned by review_etl_workflow after user review" }
                            },
                            required: ["csvContent", "tableName", "aiMappingJson", "workflowReviewToken"]
                        }
                    },
                    {
                        name: "execute_etl_pipeline_postgres",
                        description: "Executes the ETL pipeline against a real PostgreSQL/Supabase database. " +
                                     "Accepts explicit connection fields or natural-language descriptions containing " +
                                     "Postgres/Supabase credentials and an API URL. Falls back to SUPABASE_* environment variables. " +
                                     "If automatic execution cannot proceed, do not generate a standalone Python script; " +
                                     "ask the user to validate the generated ETL workflow first.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                csvContent:    { type: "string", description: "The raw CSV data" },
                                description:   { type: "string", description: "Natural-language ETL request. Can include API URL, target table, and connection details." },
                                prompt:        { type: "string", description: "Alias for description" },
                                sourceUrl:     { type: "string", description: "Optional JSON API URL to extract data from when csvContent is not provided" },
                                tableName:     { type: "string", description: "Target database table" },
                                aiMappingJson: { type: "string", description: "JSON string of AI mapping logic" },
                                host:     { type: "string", description: "Optional host override" },
                                port:     { type: "number", description: "Optional port override" },
                                database: { type: "string", description: "Optional database name override" },
                                user:     { type: "string", description: "Optional user override" },
                                password: { type: "string", description: "Optional password override" },
                                workflow: { type: "object", description: "Reviewed workflow JSON used to create workflowReviewToken" },
                                workflowReviewToken: { type: "string", description: "Token returned by review_etl_workflow after user review" }
                            },
                            required: ["workflowReviewToken"]
                        }
                    },
                    {
                        name: "execute_etl_pipelines_postgres",
                        description: "Alias of execute_etl_pipeline_postgres for natural-language clients that pluralize the tool name. " +
                                     "If automatic execution cannot proceed, ask the user to validate the generated ETL workflow first.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                csvContent:    { type: "string" },
                                description:   { type: "string" },
                                prompt:        { type: "string" },
                                sourceUrl:     { type: "string" },
                                tableName:     { type: "string" },
                                aiMappingJson: { type: "string" },
                                host:          { type: "string" },
                                port:          { type: "number" },
                                database:      { type: "string" },
                                user:          { type: "string" },
                                password:      { type: "string" },
                                workflow:      { type: "object" },
                                workflowReviewToken: { type: "string" }
                            },
                            required: ["workflowReviewToken"]
                        }
                    },
                    {
                        name: "review_etl_workflow",
                        description:
                            "Validate and mark an ETL workflow as reviewed by the user. " +
                            "Call this only after showing the generated workflow to the user and receiving explicit approval. " +
                            "Returns workflowReviewToken required by execute_etl_pipeline and execute_etl_pipeline_postgres.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                workflow: {
                                    type: "object",
                                    description: "Workflow JSON the user reviewed"
                                },
                                description: {
                                    type: "string",
                                    description: "Natural-language ETL description. Used to generate workflow when workflow is omitted."
                                },
                                userReviewed: {
                                    type: "boolean",
                                    description: "Must be true only after explicit user review/approval"
                                }
                            },
                            required: ["userReviewed"]
                        }
                    },
                    {
                        name: "get_mcp_tool_schemas",
                        description: "Return MCP tool input schemas, including execute tools and review_etl_workflow, so clients do not guess parameters.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                toolName: {
                                    type: "string",
                                    description: "Optional single tool name. Omit to return all ETL MCP tool schemas."
                                }
                            },
                            required: []
                        }
                    },
                    {
                        name: "get_etl_workflow_schema",
                        description: "Return the JSON schema for ETL workflow documents used by generate_etl_workflow, validate_graph, and review_etl_workflow.",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: []
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
                        description: "Tests whether the PostgreSQL/Supabase connection is reachable using explicit, natural-language, or .env credentials",
                        inputSchema: {
                            type: "object",
                            properties: {
                                host:     { type: "string" },
                                port:     { type: "number" },
                                database: { type: "string" },
                                user:     { type: "string" },
                                password: { type: "string" },
                                description: { type: "string" },
                                prompt: { type: "string" }
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
                                                 "Example: 'Load orders.csv, filter records before current time, convert amount to real, save to SQLite orders table'"
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
                const args = request.params.arguments as any;
                const { csvContent, tableName, aiMappingJson } = args;
                const reviewGate = this.requireWorkflowReview(args);
                if (reviewGate) {
                    return reviewGate;
                }

                try {
                    const aiMapping  = this.normalizeAiMapping(JSON.parse(aiMappingJson));
                    const connector  = new OracleMockConnector();
                    const result     = await this.engine.execute({ csvContent, tableName, dbConnector: connector, aiMapping });
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Pipeline Execution Failed: ${error.message}` }] };
                }
            }

            // ── Tool: execute_etl_pipeline_postgres (real Supabase/PG) ───────
            if (request.params.name === "execute_etl_pipeline_postgres" || request.params.name === "execute_etl_pipelines_postgres") {
                const args = request.params.arguments as any;
                const description = args?.description || args?.prompt || '';
                const reviewGate = this.requireWorkflowReview(args, description);
                if (reviewGate) {
                    return reviewGate;
                }

                const credentials = this.extractPostgresCredentials(description);
                const sourceUrl = args?.sourceUrl || this.extractFirstUrl(description);
                let resolvedCsvContent: string | undefined;

                try {
                    resolvedCsvContent = args?.csvContent || await this.fetchApiAsCsv(sourceUrl);
                } catch (error: any) {
                    return this.createWorkflowValidationRequiredResponse(description, error.message);
                }
                
                const pgConfig = {
                    host:     args?.host     || credentials.host     || process.env.SUPABASE_HOST     || '',
                    port:     args?.port     || credentials.port     || Number(process.env.SUPABASE_PORT) || 5432,
                    database: args?.database || credentials.database || process.env.SUPABASE_DB       || 'postgres',
                    user:     args?.user     || credentials.user     || process.env.SUPABASE_USER     || 'postgres',
                    password: args?.password || credentials.password || process.env.SUPABASE_PASSWORD || '',
                    sslMode:  'require' as const,
                    connectionTimeoutMillis: 8000,
                };

                if (!resolvedCsvContent) {
                    return this.createWorkflowValidationRequiredResponse(
                        description,
                        "No input data found. Pass csvContent, sourceUrl, or include an API URL in description/prompt."
                    );
                }

                const resolvedTableName = args?.tableName || this.extractTargetTableName(description, sourceUrl);
                const resolvedMappingJson = args?.aiMappingJson || JSON.stringify(this.generateIdentityMappingFromCsv(resolvedCsvContent));

                if (!pgConfig.host) {
                    return this.createWorkflowValidationRequiredResponse(
                        description,
                        "No Postgres host configured. Pass host directly or include it in description/prompt."
                    );
                }
                if (!pgConfig.password) {
                    return this.createWorkflowValidationRequiredResponse(
                        description,
                        "No Postgres password configured. Pass password directly or include it in description/prompt."
                    );
                }

                try {
                    const aiMapping  = this.normalizeAiMapping(JSON.parse(resolvedMappingJson));
                    const connector  = new PostgresConnector(pgConfig);

                    const result = await this.engine.execute({
                        csvContent: resolvedCsvContent,
                        tableName: resolvedTableName,
                        dbConnector: connector,
                        aiMapping
                    });
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                ...result,
                                tableName: resolvedTableName,
                                sourceUrl: sourceUrl || undefined,
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
                        pgCode === '28P01' ? 'Authentication failed. Check the supplied Postgres password.' :
                        pgCode === 'ENOTFOUND' ? 'Cannot reach database host. Check the supplied Postgres host.' :
                        error.message;

                    return this.createWorkflowValidationRequiredResponse(
                        description,
                        diagnosis,
                        {
                            pgErrorCode: pgCode,
                            pgDetail,
                            hint: pgCode === '42703'
                                ? 'Ask the user to validate the generated ETL workflow field mappings, then retry execution.'
                                : 'Ask the user to validate the generated ETL workflow and supplied connection details, then retry execution.'
                        }
                    );
                }
            }

            // ── Tool: test_postgres_connection ───────────────────────────────
            if (request.params.name === "test_postgres_connection") {
                const args = request.params.arguments as any;
                const credentials = this.extractPostgresCredentials(args?.description || args?.prompt || '');
                const pgConfig = {
                    host:     args?.host     || credentials.host     || process.env.SUPABASE_HOST || '',
                    port:     args?.port     || credentials.port     || Number(process.env.SUPABASE_PORT) || 5432,
                    database: args?.database || credentials.database || process.env.SUPABASE_DB  || 'postgres',
                    user:     args?.user     || credentials.user     || process.env.SUPABASE_USER || 'postgres',
                    password: args?.password || credentials.password || process.env.SUPABASE_PASSWORD || '',
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

            // ── Tool: review_etl_workflow ─────────────────────────────────────
            if (request.params.name === "review_etl_workflow") {
                const { workflow, description, userReviewed } = request.params.arguments as any;
                if (userReviewed !== true) {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                status: 'user_review_required',
                                error: 'userReviewed must be true after explicit user review before an execution token is issued.'
                            }, null, 2)
                        }]
                    };
                }

                try {
                    if (!workflow && !description) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    status: 'workflow_required',
                                    error: 'Pass either workflow or description so the MCP can validate and issue a review token.'
                                }, null, 2)
                            }]
                        };
                    }

                    const reviewedWorkflow = workflow || generateWorkflowFromDescription(description || '');
                    const validation = await this.validator.validate(reviewedWorkflow);
                    if (!validation.valid) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    status: 'workflow_validation_failed',
                                    error: 'Workflow did not pass validation. Fix or regenerate it before execution.',
                                    validation
                                }, null, 2)
                            }]
                        };
                    }

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                status: 'workflow_reviewed',
                                workflowReviewToken: this.createWorkflowReviewToken(reviewedWorkflow),
                                validation,
                                workflow: reviewedWorkflow,
                                nextAction: 'Pass workflowReviewToken and the reviewed workflow into the execute tool.'
                            }, null, 2)
                        }]
                    };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Workflow review failed: ${error.message}` }] };
                }
            }

            // ── Tool: get_mcp_tool_schemas ───────────────────────────────────
            if (request.params.name === "get_mcp_tool_schemas") {
                const { toolName } = request.params.arguments as any;
                const schemas = this.getMcpToolSchemas();
                const payload = toolName ? { [toolName]: schemas[toolName] } : schemas;

                if (toolName && !schemas[toolName]) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Tool schema not found: ${toolName}` }]
                    };
                }

                return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
            }

            // ── Tool: get_etl_workflow_schema ────────────────────────────────
            if (request.params.name === "get_etl_workflow_schema") {
                return { content: [{ type: "text", text: JSON.stringify(this.getWorkflowJsonSchema(), null, 2) }] };
            }

            // ── Tool: review_etl_workflow ─────────────────────────────────────
            if (request.params.name === "review_etl_workflow") {
                const { workflow, description, userReviewed } = request.params.arguments as any;
                if (userReviewed !== true) {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                status: 'user_review_required',
                                error: 'userReviewed must be true after explicit user review before an execution token is issued.'
                            }, null, 2)
                        }]
                    };
                }

                try {
                    if (!workflow && !description) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    status: 'workflow_required',
                                    error: 'Pass either workflow or description so the MCP can validate and issue a review token.'
                                }, null, 2)
                            }]
                        };
                    }

                    const reviewedWorkflow = workflow || generateWorkflowFromDescription(description || '');
                    const validation = await this.validator.validate(reviewedWorkflow);
                    if (!validation.valid) {
                        return {
                            isError: true,
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    status: 'workflow_validation_failed',
                                    error: 'Workflow did not pass validation. Fix or regenerate it before execution.',
                                    validation
                                }, null, 2)
                            }]
                        };
                    }

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                status: 'workflow_reviewed',
                                workflowReviewToken: this.createWorkflowReviewToken(reviewedWorkflow),
                                validation,
                                workflow: reviewedWorkflow,
                                nextAction: 'Pass workflowReviewToken and the reviewed workflow into the execute tool.'
                            }, null, 2)
                        }]
                    };
                } catch (error: any) {
                    return { isError: true, content: [{ type: "text", text: `Workflow review failed: ${error.message}` }] };
                }
            }

            // ── Tool: get_mcp_tool_schemas ───────────────────────────────────
            if (request.params.name === "get_mcp_tool_schemas") {
                const { toolName } = request.params.arguments as any;
                const schemas = this.getMcpToolSchemas();
                const payload = toolName ? { [toolName]: schemas[toolName] } : schemas;

                if (toolName && !schemas[toolName]) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Tool schema not found: ${toolName}` }]
                    };
                }

                return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
            }

            // ── Tool: get_etl_workflow_schema ────────────────────────────────
            if (request.params.name === "get_etl_workflow_schema") {
                return { content: [{ type: "text", text: JSON.stringify(this.getWorkflowJsonSchema(), null, 2) }] };
            }

            // ── Tool: generate_etl_workflow ───────────────────────────────────────────────
            if (request.params.name === "generate_etl_workflow") {
                const { description, format = 'full' } = request.params.arguments as any;
                try {
                    const workflow = generateWorkflowFromDescription(description, format);
                    await this.onWorkflowGenerated?.(workflow);
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

    private requireWorkflowReview(args: any, description = '') {
        const workflow = args?.workflow || (description ? generateWorkflowFromDescription(description) : undefined);
        const expectedToken = workflow ? this.createWorkflowReviewToken(workflow) : undefined;
        const suppliedToken = args?.workflowReviewToken;

        if (!suppliedToken) {
            return this.createWorkflowValidationRequiredResponse(
                description,
                'Execution blocked until the generated ETL workflow is reviewed by the user.',
                {
                    status: 'workflow_review_required',
                    nextAction: 'Show the workflow to the user, call review_etl_workflow with userReviewed=true, then retry execution with workflowReviewToken.',
                    workflow
                }
            );
        }

        if (!expectedToken) {
            return this.createWorkflowValidationRequiredResponse(
                description,
                'Execution blocked because workflowReviewToken cannot be verified without a workflow or description.',
                {
                    status: 'workflow_review_required',
                    nextAction: 'Pass the reviewed workflow along with workflowReviewToken, or pass the original description used to generate the workflow.'
                }
            );
        }

        if (suppliedToken !== expectedToken) {
            return this.createWorkflowValidationRequiredResponse(
                description,
                'Execution blocked because workflowReviewToken does not match the reviewed workflow.',
                {
                    status: 'workflow_review_token_invalid',
                    nextAction: 'Ask the user to review the current workflow and call review_etl_workflow again.'
                }
            );
        }

        return undefined;
    }

    private createWorkflowReviewToken(workflow: WorkflowJSON): string {
        return createHash('sha256')
            .update(this.stableStringify(workflow))
            .digest('hex');
    }

    private stableStringify(value: unknown): string {
        if (Array.isArray(value)) {
            return `[${value.map(item => this.stableStringify(item)).join(',')}]`;
        }

        if (value && typeof value === 'object') {
            return `{${Object.keys(value as Record<string, unknown>).sort().map(key =>
                `${JSON.stringify(key)}:${this.stableStringify((value as Record<string, unknown>)[key])}`
            ).join(',')}}`;
        }

        return JSON.stringify(value);
    }

    private getMcpToolSchemas(): Record<string, unknown> {
        return {
            execute_etl_pipeline: {
                type: 'object',
                required: ['csvContent', 'tableName', 'aiMappingJson', 'workflowReviewToken'],
                properties: {
                    csvContent: { type: 'string' },
                    tableName: { type: 'string' },
                    aiMappingJson: { type: 'string' },
                    workflow: this.getWorkflowJsonSchema(),
                    workflowReviewToken: { type: 'string' }
                }
            },
            execute_etl_pipeline_postgres: {
                type: 'object',
                required: ['workflowReviewToken'],
                properties: {
                    csvContent: { type: 'string' },
                    description: { type: 'string' },
                    prompt: { type: 'string' },
                    sourceUrl: { type: 'string' },
                    tableName: { type: 'string' },
                    aiMappingJson: { type: 'string' },
                    host: { type: 'string' },
                    port: { type: 'number' },
                    database: { type: 'string' },
                    user: { type: 'string' },
                    password: { type: 'string' },
                    workflow: this.getWorkflowJsonSchema(),
                    workflowReviewToken: { type: 'string' }
                }
            },
            execute_etl_pipelines_postgres: {
                aliasOf: 'execute_etl_pipeline_postgres'
            },
            review_etl_workflow: {
                type: 'object',
                required: ['userReviewed'],
                properties: {
                    workflow: this.getWorkflowJsonSchema(),
                    description: { type: 'string' },
                    userReviewed: { type: 'boolean' }
                }
            }
        };
    }

    private getWorkflowJsonSchema(): Record<string, unknown> {
        const fieldSchema = {
            type: 'object',
            required: ['id', 'name', 'type'],
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' }
            }
        };

        return {
            type: 'object',
            required: ['version', 'format', 'nodes', 'edges'],
            properties: {
                version: { type: 'number', enum: [1] },
                format: { type: 'string', enum: ['full'] },
                nodes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'type', 'data'],
                        properties: {
                            id: { type: 'string' },
                            type: { type: 'string', enum: ['source', 'transformer', 'target', 'system'] },
                            data: {
                                type: 'object',
                                properties: {
                                    label: { type: 'string' },
                                    sourceType: { type: 'string' },
                                    targetType: { type: 'string' },
                                    operation: { type: 'string' },
                                    systemType: { type: 'string' },
                                    config: { type: 'object' },
                                    inputFields: { type: 'array', items: fieldSchema },
                                    outputFields: { type: 'array', items: fieldSchema }
                                }
                            }
                        }
                    }
                },
                edges: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'type', 'source', 'sourceHandle', 'target', 'targetHandle', 'data'],
                        properties: {
                            id: { type: 'string' },
                            type: { type: 'string' },
                            source: { type: 'string' },
                            sourceHandle: { type: 'string' },
                            target: { type: 'string' },
                            targetHandle: { type: 'string' },
                            data: {
                                type: 'object',
                                properties: {
                                    mode: { type: 'string', enum: ['field', 'node'] }
                                }
                            }
                        }
                    }
                }
            }
        };
    }

    private extractPostgresCredentials(text: string): Partial<{
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    }> {
        if (!text) {
            return {};
        }

        const pick = (patterns: RegExp[]) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                const value = match?.[1]?.trim();
                if (value) {
                    return value.replace(/^["']|["']$/g, '');
                }
            }
            return undefined;
        };

        const port = pick([
            /\bSUPABASE_PORT\s*=\s*([0-9]+)/i,
            /\b(?:postgres(?:ql)?\s+)?port(?:\s+is|\s*:|=)?\s*([0-9]+)/i
        ]);

        return {
            host: pick([
                /\bSUPABASE_HOST\s*=\s*([^\s,;]+)/i,
                /\b(?:postgres(?:ql)?|supabase)?\s*host(?:\s+is|\s*:|=)?\s*([a-z0-9.-]+\.[a-z]{2,})(?=\s|,|;|$)/i
            ]),
            port: port ? Number(port) : undefined,
            database: pick([
                /\bSUPABASE_DB\s*=\s*([^\s,;]+)/i,
                /\b(?:database|db)(?:\s+name)?(?:\s+is|\s*:|=)?\s*([a-zA-Z0-9_.-]+)(?=\s|,|;|$)/i
            ]),
            user: pick([
                /\bSUPABASE_USER\s*=\s*([^\s,;]+)/i,
                /\b(?:user|username)(?:\s+is|\s*:|=)?\s*([a-zA-Z0-9_.@-]+)(?=\s|,|;|$)/i
            ]),
            password: pick([
                /\bSUPABASE_PASSWORD\s*=\s*([^\s,;]+)/i,
                /\bpassword(?:\s+is|\s*:|=)?\s*([^\s,;]+)/i
            ])
        };
    }

    private createWorkflowValidationRequiredResponse(
        description: string,
        reason: string,
        details: Record<string, unknown> = {}
    ) {
        const workflow = description ? generateWorkflowFromDescription(description) : undefined;

        return {
            isError: true,
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: false,
                    status: 'workflow_validation_required',
                    error: reason,
                    nextAction: 'Ask the user to validate the generated ETL workflow before retrying execution.',
                    instruction: 'Do not create or execute a standalone Python ETL script as a fallback.',
                    workflow,
                    ...details
                }, null, 2)
            }]
        };
    }

    private normalizeAiMapping(input: unknown): AIResponseSchema {
        const candidate = this.unwrapAiMapping(input);
        const mapping = this.normalizeMappingArray(candidate);

        if (mapping.length === 0) {
            throw new Error(
                "Invalid aiMappingJson: expected { mapping: [...] }, { mappings: [...] }, a mapping array, or an object of source-to-target fields."
            );
        }

        return {
            mapping,
            sqlTemplate: this.pickString(input, 'sqlTemplate'),
            explanation: this.pickString(input, 'explanation') ||
                'Mapping normalized by MCP before pipeline execution.'
        };
    }

    private unwrapAiMapping(input: unknown): unknown {
        if (Array.isArray(input)) {
            return input;
        }

        if (!input || typeof input !== 'object') {
            return input;
        }

        const record = input as Record<string, unknown>;
        return record.mapping ??
            record.mappings ??
            record.fieldMappings ??
            record.field_mappings ??
            record.columns ??
            record;
    }

    private normalizeMappingArray(input: unknown): AIResponseSchema['mapping'] {
        if (Array.isArray(input)) {
            return input
                .map(item => this.normalizeMappingEntry(item))
                .filter((item): item is AIResponseSchema['mapping'][number] => item !== undefined);
        }

        if (input && typeof input === 'object') {
            return Object.entries(input as Record<string, unknown>)
                .filter(([, value]) => typeof value === 'string')
                .map(([sourceField, targetField]) => ({
                    sourceField,
                    targetField: targetField as string,
                    confidenceScore: 1
                }));
        }

        return [];
    }

    private normalizeMappingEntry(input: unknown): AIResponseSchema['mapping'][number] | undefined {
        if (!input || typeof input !== 'object') {
            return undefined;
        }

        const record = input as Record<string, unknown>;
        const sourceField = this.firstString(record, [
            'sourceField',
            'source_field',
            'source',
            'from',
            'fromField',
            'inputField',
            'input'
        ]);
        const targetField = this.firstString(record, [
            'targetField',
            'target_field',
            'target',
            'to',
            'toField',
            'outputField',
            'output',
            'column'
        ]);

        if (!sourceField || !targetField) {
            return undefined;
        }

        const confidenceValue = record.confidenceScore ?? record.confidence_score ?? record.confidence;
        const confidenceScore = typeof confidenceValue === 'number'
            ? confidenceValue
            : Number(confidenceValue ?? 1);

        return {
            sourceField,
            targetField,
            transformLogic: this.firstString(record, ['transformLogic', 'transform_logic', 'transform', 'expression']),
            confidenceScore: Number.isFinite(confidenceScore) ? confidenceScore : 1
        };
    }

    private firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
        for (const key of keys) {
            const value = record[key];
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }

        return undefined;
    }

    private pickString(input: unknown, key: string): string | undefined {
        if (!input || typeof input !== 'object') {
            return undefined;
        }

        const value = (input as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : undefined;
    }

    private extractFirstUrl(text: string): string | undefined {
        return text.match(/https?:\/\/[^\s,;]+/i)?.[0];
    }

    private extractTargetTableName(description: string, sourceUrl?: string): string {
        const explicit = description.match(/(?:save|write|insert|load)\s+(?:the\s+)?(?:data\s+)?(?:to|into)\s+(?:(?:postgres|postgresql|supabase)\s+)?(?:table\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i)?.[1] ||
            description.match(/table\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)?.[1];

        if (explicit && !['postgres', 'postgresql', 'supabase', 'the', 'data'].includes(explicit.toLowerCase())) {
            return explicit;
        }

        const pathName = sourceUrl ? new URL(sourceUrl).pathname.split('/').filter(Boolean).pop() : undefined;
        return pathName?.replace(/[^a-zA-Z0-9_]/g, '_') || 'etl_output';
    }

    private async fetchApiAsCsv(sourceUrl?: string): Promise<string | undefined> {
        if (!sourceUrl) {
            return undefined;
        }

        const response = await fetch(sourceUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch source API ${sourceUrl}: HTTP ${response.status}`);
        }

        const payload = await response.json();
        const rows = this.extractRowsFromJson(payload);
        if (rows.length === 0) {
            throw new Error(`Source API ${sourceUrl} did not return any rows`);
        }

        return Papa.unparse(rows.map(row => this.flattenJsonRow(row)));
    }

    private extractRowsFromJson(payload: any): any[] {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (payload && typeof payload === 'object') {
            const firstArray = Object.values(payload).find(Array.isArray);
            if (Array.isArray(firstArray)) {
                return firstArray;
            }
        }

        return payload && typeof payload === 'object' ? [payload] : [];
    }

    private flattenJsonRow(row: any, prefix = ''): Record<string, any> {
        const flattened: Record<string, any> = {};

        for (const [key, value] of Object.entries(row ?? {})) {
            const fieldName = this.toSnakeCase(prefix ? `${prefix}_${key}` : key);
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(flattened, this.flattenJsonRow(value, fieldName));
            } else if (Array.isArray(value)) {
                flattened[fieldName] = JSON.stringify(value);
            } else {
                flattened[fieldName] = value;
            }
        }

        return flattened;
    }

    private generateIdentityMappingFromCsv(csvContent: string): AIResponseSchema {
        const parsed = Papa.parse<Record<string, unknown>>(csvContent, {
            header: true,
            preview: 1,
            skipEmptyLines: true
        });
        const fields = parsed.meta.fields ?? [];

        return {
            mapping: fields.map(field => ({
                sourceField: field,
                targetField: this.toSnakeCase(field),
                confidenceScore: 1
            })),
            explanation: 'Generated identity mapping from source fields discovered at MCP execution time.'
        };
    }

    private toSnakeCase(value: string): string {
        return value
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
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

        // Session-keyed map: each /sse client gets its own fresh ETLMCPServer instance.
        // The MCP SDK Server class is single-transport — calling connect() a second time
        // throws "Already connected to a transport". Creating one instance per SSE
        // connection is the correct pattern for concurrent HTTP clients.
        const sessions = new Map<string, SSEServerTransport>();

        app.get("/sse", async (req, res) => {
            const transport = new SSEServerTransport("/message", res);
            const sessionId  = transport.sessionId;
            sessions.set(sessionId, transport);

            // Remove session when the client closes the SSE stream
            res.on("close", () => sessions.delete(sessionId));

            // Fresh isolated server instance — avoids the "already connected" crash
            const instance = new ETLMCPServer(this.onWorkflowGenerated);
            await instance.initialize();
            await instance.server.connect(transport);
        });

        app.post("/message", async (req, res) => {
            // IBM Bob sends sessionId as a query param; fall back to the only open session
            const sessionId = (req.query.sessionId as string) ?? [...sessions.keys()][0];
            const transport = sessions.get(sessionId);
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(503).json({
                    error: "No active MCP session. Connect via GET /sse first."
                });
            }
        });

        app.listen(port, () => {
            console.log(`MCP SSE Server listening on http://localhost:${port}/sse`);
        });
    }
}
