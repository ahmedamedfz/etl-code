import * as sqlite3 from 'sqlite3';
import { IDatabaseConnector } from '../types';

export class SqliteConnector implements IDatabaseConnector {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async disconnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    async query(sql: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database not connected'));
            }
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.connect();
            await this.query('SELECT 1');
            return true;
        } catch (error) {
            console.error('SQLite connection failed', error);
            return false;
        }
    }
}
