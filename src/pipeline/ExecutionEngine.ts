import { IDatabaseConnector, AIResponseSchema, ExecutionResultSchema } from '../types';
import { CSVProcessor } from '../csv/CSVProcessor';
import { SQLGenerator } from '../sql/SQLGenerator';
import { PipelineLogger } from './Logger';
import { SqliteConnector } from '../db/SqliteConnector';

export interface ExecutionContext {
    csvContent: string;
    tableName: string;
    dbConnector: IDatabaseConnector;
    aiMapping: AIResponseSchema;
}

export class ExecutionEngine {
    private logger: PipelineLogger;
    private csvProcessor: CSVProcessor;
    private sqlGenerator: SQLGenerator;

    constructor() {
        this.logger = new PipelineLogger();
        this.csvProcessor = new CSVProcessor();
        this.sqlGenerator = new SQLGenerator();
    }

    async execute(context: ExecutionContext): Promise<ExecutionResultSchema> {
        this.logger.start();
        let rowsAffected = 0;
        let activeConnector = context.dbConnector;
        let isFallback = false;

        try {
            // Step 1: Parse CSV
            this.logger.log('INFO', 'Parse', 'Parsing CSV content');
            const data = this.csvProcessor.parse(context.csvContent);
            if (data.length === 0) {
                throw new Error('CSV is empty');
            }

            // Step 2: Generate SQL
            this.logger.log('INFO', 'Transform', 'Generating SQL statements from mapping');
            const sqlStatements = this.sqlGenerator.generateInsertSQL(context.tableName, context.aiMapping.mapping, data);

            // Step 3: Connect to DB (with fallback)
            try {
                await activeConnector.connect();
            } catch (dbError) {
                this.logger.log('WARN', 'Connection', 'Primary DB connection failed, falling back to SQLite');
                activeConnector = new SqliteConnector(':memory:');
                await activeConnector.connect();
                // Create table in fallback SQLite
                const createTableSql = `CREATE TABLE ${context.tableName} (${context.aiMapping.mapping.map(m => `${m.targetField} TEXT`).join(', ')});`;
                await activeConnector.query(createTableSql);
                isFallback = true;
            }

            // Step 4: Execute SQL
            this.logger.log('INFO', 'Load', `Executing ${sqlStatements.length} insert statements${isFallback ? ' (Fallback DB)' : ''}`);

            for (const [index, sql] of sqlStatements.entries()) {
                try {
                    await activeConnector.query(sql);
                    rowsAffected++;
                } catch (sqlError: any) {
                    this.logger.log('WARN', 'Load', `Failed to execute statement ${index}: ${sql}`, sqlError.message);
                }
            }

            this.logger.log('INFO', 'Explanation', 'AI Explanation of Transformation', context.aiMapping.explanation);

        } catch (error: any) {
            this.logger.log('ERROR', 'Execution', 'Pipeline execution failed', error.message);
            this.logger.end();
            return {
                success: false,
                error: error.message,
                executionTimeMs: this.logger.getExecutionTimeMs(),
                logs: this.logger.getLogs().map(l => `[${l.level}] ${l.message}`)
            };
        } finally {
            try {
                await activeConnector.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }

        this.logger.end();

        return {
            success: true,
            rowsAffected,
            executionTimeMs: this.logger.getExecutionTimeMs(),
            logs: this.logger.getLogs().map(l => `[${l.level}] ${l.step}: ${l.message}`)
        };
    }
}
