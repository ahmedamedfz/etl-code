import { Pool, PoolConfig } from 'pg';
import { IDatabaseConnector } from '../types';

export interface PostgresConnectorConfig extends PoolConfig {
    /**
     * Set to true for cloud-hosted Postgres (e.g. Supabase, RDS) that requires
     * SSL but uses a self-signed or Supabase-managed certificate.
     * When true: `ssl: { rejectUnauthorized: false }` is applied.
     */
    sslMode?: 'require' | 'disable';
}

export class PostgresConnector implements IDatabaseConnector {
    private pool: Pool;

    constructor(config: PostgresConnectorConfig) {
        const poolConfig: PoolConfig = { ...config };

        // Supabase and most cloud Postgres providers require SSL
        if (config.sslMode === 'require' || !poolConfig.ssl) {
            poolConfig.ssl = { rejectUnauthorized: false };
        } else if (config.sslMode === 'disable') {
            poolConfig.ssl = false;
        }

        // Remove custom key before passing to pg
        delete (poolConfig as any).sslMode;

        this.pool = new Pool(poolConfig);
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
