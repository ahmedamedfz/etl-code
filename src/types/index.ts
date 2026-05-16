export interface IDatabaseConnector {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query(sql: string, params?: any[]): Promise<any>;
    testConnection(): Promise<boolean>;
}

export type PipelineNodeType = 'source' | 'transform' | 'destination';

export interface PipelineNode {
    id: string;
    type: PipelineNodeType;
    label: string;
    config: Record<string, any>;
}

export interface AIResponseSchema {
    mapping: Array<{
        sourceField: string;
        targetField: string;
        transformLogic?: string;
        confidenceScore: number;
    }>;
    sqlTemplate?: string;
    explanation?: string;
}

export interface ExecutionResultSchema {
    success: boolean;
    rowsAffected?: number;
    error?: string;
    executionTimeMs: number;
    logs: string[];
}
