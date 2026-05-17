import * as fs from 'fs';
import * as path from 'path';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ToolFlowLogEntry {
    timestamp: string;
    event: 'tool_call_start' | 'tool_call_result' | 'tool_call_error' | 'list_tools';
    sequence: number;
    toolName?: string;
    durationMs?: number;
    prompt?: string;
    arguments?: JsonValue;
    result?: JsonValue;
    error?: JsonValue;
}

export class ToolFlowLogger {
    private sequence = 0;
    private readonly logFilePath: string;
    private readonly sensitiveKeys = new Set([
        'apikey',
        'api_key',
        'authorization',
        'bearer',
        'password',
        'token',
        'workflowreviewtoken',
        'secret'
    ]);

    constructor(logFilePath = process.env.ETL_CODE_TOOL_FLOW_LOG || path.resolve(process.cwd(), 'logs', 'mcp-tool-flow.log')) {
        this.logFilePath = logFilePath;
    }

    nextSequence(): number {
        this.sequence += 1;
        return this.sequence;
    }

    log(entry: Omit<ToolFlowLogEntry, 'timestamp'>): void {
        try {
            fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
            fs.appendFileSync(
                this.logFilePath,
                `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`,
                'utf-8'
            );
        } catch (error) {
            console.warn('[ToolFlowLogger] Failed to write MCP tool flow log', error);
        }
    }

    extractPrompt(argumentsValue: unknown): string | undefined {
        if (!argumentsValue || typeof argumentsValue !== 'object') {
            return undefined;
        }

        const args = argumentsValue as Record<string, unknown>;
        const prompt = args.prompt ?? args.description ?? args.naturalLanguage ?? args.userResponse;
        return typeof prompt === 'string' ? prompt : undefined;
    }

    sanitize(value: unknown, depth = 0): JsonValue {
        if (depth > 8) {
            return '[Max depth reached]';
        }

        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(item => this.sanitize(item, depth + 1));
        }

        if (typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, item]) => [
                    key,
                    this.isSensitiveKey(key) ? '[REDACTED]' : this.sanitize(item, depth + 1)
                ])
            );
        }

        return String(value);
    }

    getLogFilePath(): string {
        return this.logFilePath;
    }

    private isSensitiveKey(key: string): boolean {
        const normalized = key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        return this.sensitiveKeys.has(normalized) ||
            normalized.includes('password') ||
            normalized.includes('secret') ||
            normalized.endsWith('token') ||
            normalized.endsWith('apikey');
    }
}
