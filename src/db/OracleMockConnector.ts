import { IDatabaseConnector } from '../types';

export class OracleMockConnector implements IDatabaseConnector {
    private isConnected = false;

    async connect(): Promise<void> {
        // Simulate connection delay
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
        
        console.log(`Mock Oracle executing: ${sql} with params:`, params);
        
        // Return fake data based on simple regex matching to simulate a schema response
        if (sql.toLowerCase().includes('select * from user_tables')) {
            return [{ TABLE_NAME: 'USERS' }, { TABLE_NAME: 'ORDERS' }];
        }
        
        if (sql.toLowerCase().includes('select * from users')) {
            return [
                { id: 1, name: 'John Doe', email: 'john@example.com' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
            ];
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
}
