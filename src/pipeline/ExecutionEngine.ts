import { IDatabaseConnector, AIResponseSchema, ExecutionResultSchema, CompatibilityWarning } from '../types';
import { CSVProcessor } from '../csv/CSVProcessor';
import { SQLGenerator } from '../sql/SQLGenerator';
import { PipelineLogger } from './Logger';
import { SqliteConnector } from '../db/SqliteConnector';
import { CompatibilityAnalyzer } from './CompatibilityAnalyzer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ExecutionContext {
    csvContent: string;
    tableName: string;
    dbConnector: IDatabaseConnector;
    aiMapping: AIResponseSchema;
    internalSqlitePath?: string;
    createTargetTable?: boolean;
}

export class ExecutionEngine {
    private logger: PipelineLogger;
    private csvProcessor: CSVProcessor;
    private sqlGenerator: SQLGenerator;
    private compatibilityAnalyzer: CompatibilityAnalyzer;

    constructor() {
        this.logger = new PipelineLogger();
        this.csvProcessor = new CSVProcessor();
        this.sqlGenerator = new SQLGenerator();
        this.compatibilityAnalyzer = new CompatibilityAnalyzer();
    }

    async execute(context: ExecutionContext): Promise<ExecutionResultSchema> {
        // Reset logger for each new execution to prevent log bleed across calls
        this.logger = new PipelineLogger();
        this.logger.start();
        let rowsAffected = 0;
        let activeConnector = context.dbConnector;
        let isFallback = false;
        let warnings: CompatibilityWarning[] = [];
        let sqlStatements: string[] = [];

        try {
            // Step 1: Parse CSV
            this.logger.log('INFO', 'Parse', 'Parsing CSV content');
            const data = this.csvProcessor.parse(context.csvContent);
            if (data.length === 0) {
                throw new Error('CSV is empty');
            }

            // Step 2: Infer schema and run compatibility analysis
            const sourceSchema = this.csvProcessor.inferSchema(data);
            warnings = this.compatibilityAnalyzer.analyze(context.aiMapping.mapping, sourceSchema);

            const explanation = this.compatibilityAnalyzer.generateExplanation(
                context.aiMapping.mapping,
                warnings,
                context.aiMapping.explanation
            );

            if (warnings.length > 0) {
                this.logger.log('WARN', 'CompatibilityCheck', `${warnings.length} compatibility warning(s) detected`);
                for (const w of warnings) {
                    this.logger.log('WARN', 'CompatibilityCheck', w.message);
                }
            } else {
                this.logger.log('INFO', 'CompatibilityCheck', 'No compatibility issues found');
            }

            // Step 3: Generate SQL
            this.logger.log('INFO', 'Transform', 'Generating SQL statements from mapping');
            sqlStatements = this.sqlGenerator.generateInsertSQL(context.tableName, context.aiMapping.mapping, data);

            // Step 4: Validate generated target schema and inserts against local SQLite first
            await this.preflightWithInternalSqlite(context, sqlStatements);

            // Step 5: Connect to DB (with fallback)
            try {
                await activeConnector.connect();
            } catch (dbError) {
                this.logger.log('WARN', 'Connection', 'Primary DB connection failed, falling back to SQLite');
                activeConnector = new SqliteConnector(':memory:');
                await activeConnector.connect();
                isFallback = true;
            }

            if (context.createTargetTable !== false) {
                await activeConnector.query(this.sqlGenerator.generateCreateTableSQL(context.tableName, context.aiMapping.mapping));
                this.logger.log('INFO', 'TargetSchema', `Target table "${context.tableName}" is ready`);
            }

            // Step 6: Execute SQL (insert executor)
            this.logger.log('INFO', 'Load', `Executing ${sqlStatements.length} insert statements${isFallback ? ' (Fallback DB)' : ''}`);

            for (const [index, sql] of sqlStatements.entries()) {
                try {
                    await activeConnector.query(sql);
                    rowsAffected++;
                    this.logger.log('INFO', 'Load', `Row ${index + 1} inserted`);
                } catch (sqlError: any) {
                    this.logger.log('WARN', 'Load', `Failed to execute statement ${index + 1}: ${sql}`, sqlError.message);
                }
            }

            // Step 6: Log AI explanation
            this.logger.log('INFO', 'Explanation', 'Transformation explanation', explanation);

        } catch (error: any) {
            this.logger.log('ERROR', 'Execution', 'Pipeline execution failed', error.message);
            this.logger.end();
            return {
                success: false,
                error: error.message,
                executionTimeMs: this.logger.getExecutionTimeMs(),
                logs: this.logger.getLogs().map(l => `[${l.level}] ${l.message}`),
                warnings
            };
        } finally {
            try {
                await activeConnector.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }

        this.logger.end();

        const result: ExecutionResultSchema = {
            success: true,
            rowsAffected,
            executionTimeMs: this.logger.getExecutionTimeMs(),
            logs: this.logger.getLogs().map(l => `[${l.level}] ${l.step}: ${l.message}`),
            warnings
        };

        // Demo Safety: backup SQL and logs to disk after every successful run
        this.writeBackups(context.tableName, sqlStatements ?? [], result.logs);

        return result;
    }

    private writeBackups(tableName: string, sqlStatements: string[], logs: string[]) {
        try {
            const backupDir = path.join(os.tmpdir(), 'etl-code-backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            // Backup generated SQL
            const sqlFile = path.join(backupDir, `${tableName}-${timestamp}.sql`);
            fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf-8');

            // Backup execution logs
            const logFile = path.join(backupDir, `execution-${timestamp}.log`);
            fs.writeFileSync(logFile, logs.join('\n'), 'utf-8');

            console.log(`[Backup] SQL → ${sqlFile}`);
            console.log(`[Backup] Logs → ${logFile}`);
        } catch (e) {
            // Backup failures must never crash the pipeline
            console.warn('[Backup] Failed to write backup files', e);
        }
    }

    private async preflightWithInternalSqlite(context: ExecutionContext, sqlStatements: string[]): Promise<void> {
        const sqlitePath = context.internalSqlitePath || path.resolve(process.cwd(), 'sqlite.db');
        const preflightConnector = new SqliteConnector(sqlitePath);

        this.logger.log('INFO', 'SQLitePreflight', `Testing target schema in ${sqlitePath}`);

        try {
            await preflightConnector.connect();
            await preflightConnector.query(this.sqlGenerator.generateDropTableSQL(context.tableName));
            await preflightConnector.query(this.sqlGenerator.generateCreateTableSQL(context.tableName, context.aiMapping.mapping));

            for (const sql of sqlStatements) {
                await preflightConnector.query(sql);
            }

            this.logger.log('INFO', 'SQLitePreflight', `Schema and ${sqlStatements.length} insert statement(s) validated`);
        } finally {
            await preflightConnector.disconnect();
        }
    }
}
