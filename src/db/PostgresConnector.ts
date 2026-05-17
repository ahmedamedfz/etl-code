import { Pool, PoolConfig } from 'pg';
import { IDatabaseConnector } from '../types';

export class PostgresConnector implements IDatabaseConnector {
    private pool: Pool;

    constructor(config: PoolConfig) {
        this.pool = new Pool(config);
    }

    async connect(): Promise<void> {
        const client = await this.pool.connect();
        client.release();
    }

    async disconnect(): Promise<void> {
        await this.pool.end();
    }

    async query(sql: string, params?: any[]): Promise<any> {
        const result = await this.pool.query(sql, params);
        return result.rows;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.connect();
            return true;
        } catch (error) {
            console.error('Postgres connection failed', error);
            return false;
        }
    }
}
