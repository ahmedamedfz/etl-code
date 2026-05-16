import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";

import { ExecutionEngine } from "../pipeline/ExecutionEngine";
import { OracleMockConnector } from "../db/OracleMockConnector";

export class ETLMCPServer {
    private server: Server;
    private engine: ExecutionEngine;

    constructor() {
        this.engine = new ExecutionEngine();
        
        this.server = new Server(
            {
                name: "etl-code-mcp-server",
                version: "1.0.0"
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );

        this.setupHandlers();
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "execute_etl_pipeline",
                        description: "Executes the ETL pipeline with the given CSV content and mapping",
                        inputSchema: {
                            type: "object",
                            properties: {
                                csvContent: { type: "string", description: "The raw CSV data" },
                                tableName: { type: "string", description: "Target database table" },
                                aiMappingJson: { type: "string", description: "JSON string of AI mapping logic" }
                            },
                            required: ["csvContent", "tableName", "aiMappingJson"]
                        }
                    },
                    {
                        name: "preview_database_schema",
                        description: "Gets the mock Oracle database schema for mapping",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: []
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === "execute_etl_pipeline") {
                const { csvContent, tableName, aiMappingJson } = request.params.arguments as any;
                
                try {
                    const aiMapping = JSON.parse(aiMappingJson);
                    const connector = new OracleMockConnector();
                    
                    const result = await this.engine.execute({
                        csvContent,
                        tableName,
                        dbConnector: connector,
                        aiMapping
                    });

                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    };
                } catch (error: any) {
                    return {
                        isError: true,
                        content: [
                            { type: "text", text: `Pipeline Execution Failed: ${error.message}` }
                        ]
                    };
                }
            } else if (request.params.name === "preview_database_schema") {
                const connector = new OracleMockConnector();
                await connector.connect();
                // Simple hardcoded mock schema response for tools
                const schema = [
                    { name: "user_id", type: "number" },
                    { name: "name", type: "string" },
                    { name: "user_age", type: "number" },
                    { name: "email_address", type: "string" }
                ];

                return {
                    content: [
                        { type: "text", text: JSON.stringify(schema, null, 2) }
                    ]
                };
            }

            throw new Error(`Tool not found: ${request.params.name}`);
        });
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
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(503).send("Server not connected");
            }
        });

        app.listen(port, () => {
            console.log(`MCP SSE Server listening on port ${port}`);
        });
    }
}
