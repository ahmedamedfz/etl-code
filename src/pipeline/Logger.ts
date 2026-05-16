export interface LogEntry {
    timestamp: Date;
    level: 'INFO' | 'WARN' | 'ERROR';
    step: string;
    message: string;
    details?: any;
}

export class PipelineLogger {
    private logs: LogEntry[] = [];
    private startTime: number = 0;

    start() {
        this.startTime = Date.now();
        this.log('INFO', 'PipelineStart', 'Pipeline execution started');
    }

    log(level: 'INFO' | 'WARN' | 'ERROR', step: string, message: string, details?: any) {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            step,
            message,
            details
        };
        this.logs.push(entry);
        
        // Console output for debugging
        const prefix = `[${entry.timestamp.toISOString()}] [${level}] [${step}]`;
        if (level === 'ERROR') {
            console.error(prefix, message, details || '');
        } else if (level === 'WARN') {
            console.warn(prefix, message, details || '');
        } else {
            console.log(prefix, message, details || '');
        }
    }

    end() {
        const duration = Date.now() - this.startTime;
        this.log('INFO', 'PipelineEnd', `Pipeline execution finished in ${duration}ms`);
    }

    getLogs() {
        return this.logs;
    }

    getExecutionTimeMs() {
        return Date.now() - this.startTime;
    }
}
