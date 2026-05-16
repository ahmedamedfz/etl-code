import * as Papa from 'papaparse';

export interface ColumnSchema {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    hasNulls: boolean;
}

export class CSVProcessor {
    parse(csvContent: string): any[] {
        const result = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false // We will do our own inference
        });

        if (result.errors.length > 0) {
            console.warn('CSV Parse warnings:', result.errors);
        }

        return result.data;
    }

    inferSchema(data: any[]): ColumnSchema[] {
        if (!data || data.length === 0) return [];

        const columns = Object.keys(data[0]);
        return columns.map(col => {
            const values = data.map(row => row[col]);
            return {
                name: col,
                type: this.detectType(values),
                hasNulls: this.detectNulls(values)
            };
        });
    }

    private detectType(values: any[]): 'string' | 'number' | 'boolean' | 'date' {
        const nonNulls = values.filter(v => v !== null && v !== undefined && v !== '');
        if (nonNulls.length === 0) return 'string';

        const isNumber = nonNulls.every(v => !isNaN(Number(v)));
        if (isNumber) return 'number';

        const isBoolean = nonNulls.every(v => {
            const lower = String(v).toLowerCase();
            return lower === 'true' || lower === 'false' || lower === '1' || lower === '0';
        });
        if (isBoolean) return 'boolean';

        const isDate = nonNulls.every(v => !isNaN(Date.parse(v)));
        if (isDate) return 'date';

        return 'string';
    }

    private detectNulls(values: any[]): boolean {
        return values.some(v => v === null || v === undefined || v === '');
    }
}
