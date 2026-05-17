/// <reference types="node" />
import * as fs from 'fs';
import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

type SchemaField = {
    id: string;
    name: string;
    type: string;
};

export class SchemaFetcher {

    private static inferPrimitiveType(value: string): string {
        const trimmed = value.trim();

        if (trimmed === '') {
            return 'null';
        }

        // Boolean
        if (/^(true|false)$/i.test(trimmed)) {
            return 'boolean';
        }

        // Integer
        if (/^-?\d+$/.test(trimmed)) {
            return 'integer';
        }

        // Float / Decimal
        if (/^-?\d+\.\d+$/.test(trimmed)) {
            return 'float';
        }

        // Date
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
            return 'date';
        }

        return 'string';
    }

    private static mergeTypes(existing: string, incoming: string): string {
        if (existing === incoming) {
            return existing;
        }

        // Ignore nulls
        if (existing === 'null') {
            return incoming;
        }

        if (incoming === 'null') {
            return existing;
        }

        // integer + float => float
        const numericTypes = ['integer', 'float'];

        if (
            numericTypes.includes(existing) &&
            numericTypes.includes(incoming)
        ) {
            return 'float';
        }

        // Anything mixed with string => string
        return 'string';
    }

    static async fetchCsvSchema(
        filePath: string,
        delimiter: string = ',',
        skipRows: number = 0,
        sampleSize: number = 50
    ): Promise<SchemaField[]> {

        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        return new Promise((resolve, reject) => {

            const fileStream = fs.createReadStream(filePath);

            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let currentLine = 0;
            let headers: string[] = [];
            let inferredTypes: string[] = [];
            let sampledRows = 0;

            rl.on('line', (line) => {

                // Skip metadata rows
                if (currentLine < skipRows) {
                    currentLine++;
                    return;
                }

                // Header row
                if (currentLine === skipRows) {

                    headers = line
                        .split(delimiter)
                        .map(h => h.trim());

                    inferredTypes = new Array(headers.length).fill('null');

                    currentLine++;
                    return;
                }

                // Sample rows
                if (sampledRows < sampleSize) {

                    const values = line.split(delimiter);

                    values.forEach((value, index) => {

                        const detectedType =
                            this.inferPrimitiveType(value);

                        inferredTypes[index] =
                            this.mergeTypes(
                                inferredTypes[index],
                                detectedType
                            );
                    });

                    sampledRows++;
                }

                // Enough samples
                if (sampledRows >= sampleSize) {

                    rl.close();
                    fileStream.close();

                    const fields: SchemaField[] =
                        headers.map((header, index) => ({
                            id: `col_${index}`,
                            name: header || `column_${index}`,
                            type: inferredTypes[index] || 'string'
                        }));

                    resolve(fields);
                }

                currentLine++;
            });

            rl.on('close', () => {

                // Handle small files
                if (headers.length > 0) {

                    const fields: SchemaField[] =
                        headers.map((header, index) => ({
                            id: `col_${index}`,
                            name: header || `column_${index}`,
                            type: inferredTypes[index] || 'string'
                        }));

                    resolve(fields);
                }
            });

            rl.on('error', (err) => {
                reject(err);
            });
        });
    }

    static async fetchRestApiSchema(
        url: string,
        method: string = 'GET'
    ): Promise<any[]> {

        if (!url) {
            throw new Error('URL is required');
        }

        try {

            const response = await fetch(url, { method });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            let sampleObject = data;

            if (Array.isArray(data)) {
                sampleObject = data[0];
            } else if (data && typeof data === 'object') {
                const firstArray = Object.values(data).find(Array.isArray);
                if (Array.isArray(firstArray)) {
                    sampleObject = firstArray[0];
                }
            }

            if (!sampleObject) {
                return [];
            }

            if (typeof sampleObject === 'object' && sampleObject !== null) {
                return this.flattenApiSchema(sampleObject).map((field, index) => ({
                    id: `api_field_${index}`,
                    ...field
                }));
            }

            return [
                {
                    id: 'f1',
                    name: 'data',
                    type: typeof data
                }
            ];

        } catch (error: any) {

            throw new Error(
                `Failed to fetch API schema: ${error.message}`
            );
        }
    }

    private static flattenApiSchema(
        sampleObject: Record<string, any>,
        prefix = ''
    ): Array<{ name: string; type: string }> {
        return Object.entries(sampleObject).flatMap(([key, value]) => {
            const fieldName = this.toSnakeCase(prefix ? `${prefix}_${key}` : key);

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return this.flattenApiSchema(value, fieldName);
            }

            return [{
                name: fieldName,
                type: Array.isArray(value) ? 'string' : this.normalizeApiType(value)
            }];
        });
    }

    private static normalizeApiType(value: unknown): string {
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'integer' : 'float';
        }

        if (typeof value === 'boolean') {
            return 'boolean';
        }

        return 'string';
    }

    private static toSnakeCase(value: string): string {
        return value
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
    }

    static async fetchSqliteSchema(
        connectionString: string,
        tableName: string
    ): Promise<any[]> {

        if (!connectionString || !tableName) {
            throw new Error(
                'Database path (connection string) and table name are required'
            );
        }

        try {

            const command =
                `sqlite3 "${connectionString}" ` +
                `"PRAGMA table_info('${tableName}');"`;

            const { stdout } = await execAsync(command);

            const lines = stdout.trim().split('\n');

            if (
                lines.length === 0 ||
                lines[0] === ''
            ) {
                throw new Error(
                    `Table not found or has no columns: ${tableName}`
                );
            }

            return lines.map((line) => {
                const parts = line.split('|').map(p => p.trim());

                return {
                    id: `sql_col_${parts[0]}`,
                    name: parts[1],
                    type: parts[2]
                        ? parts[2].toLowerCase()
                        : 'any'
                };
            });

        } catch (error: any) {

            throw new Error(
                `Failed to fetch SQLite schema: ${error.message}`
            );
        }
    }
}
