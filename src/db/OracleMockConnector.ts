import { IDatabaseConnector } from '../types';

export interface MockTableColumn {
    name: string;
    type: 'VARCHAR2' | 'NUMBER' | 'DATE' | 'CLOB';
    nullable: boolean;
}

export interface MockTableSchema {
    tableName: string;
    columns: MockTableColumn[];
    previewRows: Record<string, any>[];
}

// Curated dataset for demo stability
const MOCK_SCHEMAS: Record<string, MockTableSchema> = {
    USERS: {
        tableName: 'USERS',
        columns: [
            { name: 'user_id',       type: 'NUMBER',   nullable: false },
            { name: 'full_name',     type: 'VARCHAR2', nullable: false },
            { name: 'email_address', type: 'VARCHAR2', nullable: true  },
            { name: 'user_age',      type: 'NUMBER',   nullable: true  },
        ],
        previewRows: [
            { user_id: 1, full_name: 'Alice Johnson', email_address: 'alice@example.com', user_age: 28 },
            { user_id: 2, full_name: 'Bob Smith',     email_address: 'bob@example.com',   user_age: null },
        ]
    },
    ORDERS: {
        tableName: 'ORDERS',
        columns: [
            { name: 'order_id',    type: 'NUMBER',   nullable: false },
            { name: 'customer_id', type: 'NUMBER',   nullable: false },
            { name: 'order_date',  type: 'DATE',     nullable: false },
            { name: 'total_amt',   type: 'NUMBER',   nullable: true  },
        ],
        previewRows: [
            { order_id: 101, customer_id: 1, order_date: '2024-01-15', total_amt: 250.00 },
            { order_id: 102, customer_id: 2, order_date: '2024-01-16', total_amt: null   },
        ]
    }
};

export class OracleMockConnector implements IDatabaseConnector {
    private isConnected = false;

    async connect(): Promise<void> {
        // Simulate realistic connection delay
        await new Promise(resolve => setTimeout(resolve, 500));
        this.isConnected = true;
    }

    async disconnect(): Promise<void> {
        this.isConnected = false;
    }

    async query(sql: string, params?: any[]): Promise<any> {
        if (!this.isConnected) {
            throw new Error('Not connected to mock Oracle DB');
        }

        const normalized = sql.toLowerCase().trim();

        // Schema listing
        if (normalized.includes('select * from user_tables')) {
            return Object.keys(MOCK_SCHEMAS).map(t => ({ TABLE_NAME: t }));
        }

        // Column listing for a specific table
        const descMatch = normalized.match(/describe\s+(\w+)/);
        if (descMatch) {
            const tableName = descMatch[1].toUpperCase();
            const schema = MOCK_SCHEMAS[tableName];
            return schema ? schema.columns : [];
        }

        // Preview rows from a specific table
        const selectMatch = normalized.match(/select \* from (\w+)/);
        if (selectMatch) {
            const tableName = selectMatch[1].toUpperCase();
            const schema = MOCK_SCHEMAS[tableName];
            return schema ? schema.previewRows : [];
        }

        // INSERT / DDL statements — silently succeed (mock)
        if (normalized.startsWith('insert') || normalized.startsWith('create') || normalized.startsWith('drop')) {
            return { affectedRows: 1 };
        }

        return [];
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.connect();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Returns the mock schema for a given table — used by MCP tool `preview_database_schema`.
     */
    getTableSchema(tableName: string): MockTableSchema | undefined {
        return MOCK_SCHEMAS[tableName.toUpperCase()];
    }

    /**
     * Returns all available table names in the mock Oracle DB.
     */
    getAvailableTables(): string[] {
        return Object.keys(MOCK_SCHEMAS);
    }
}
