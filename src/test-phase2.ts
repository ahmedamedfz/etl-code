import { CSVProcessor } from './csv/CSVProcessor';
import { SQLGenerator } from './sql/SQLGenerator';
import { AIResponseSchema } from './types';

async function runPhase2() {
    console.log('--- Phase 2 Milestone Check ---');

    // 1. CSV Processing & Schema Inference
    const csvContent = `id,first_name,age,email\n1,John,30,john@example.com\n2,Jane,,jane@example.com`;
    const processor = new CSVProcessor();
    const data = processor.parse(csvContent);
    const schema = processor.inferSchema(data);
    
    console.log('CSV Data:', data);
    console.log('Inferred Schema:', schema);
    const schemaStable = schema.find(s => s.name === 'age')?.hasNulls === true && schema.find(s => s.name === 'age')?.type === 'number';
    console.log(`Schema inference stable: ${schemaStable ? '✅' : '❌'}`);

    // 2. AI returns valid JSON (Mocking the AI map logic since we tested endpoint in Phase 1)
    const mockAiResponse: AIResponseSchema = {
        mapping: [
            { sourceField: 'id', targetField: 'user_id', confidenceScore: 0.99 },
            { sourceField: 'first_name', targetField: 'name', transformLogic: 'value.toUpperCase()', confidenceScore: 0.95 },
            { sourceField: 'age', targetField: 'user_age', confidenceScore: 0.9 },
            { sourceField: 'email', targetField: 'email_address', confidenceScore: 1.0 }
        ],
        explanation: 'Mapped based on semantic similarity'
    };
    console.log(`AI returns valid JSON: ✅ (Mocked for testing logic)`);

    // 3. SQL Generation
    const sqlGen = new SQLGenerator();
    const sqlStatements = sqlGen.generateInsertSQL('users', mockAiResponse.mapping, data);
    console.log('Generated SQL:');
    sqlStatements.forEach(s => console.log('  ' + s));
    
    const sqlWorks = sqlStatements.length === 2 && sqlStatements[0].includes('JOHN');
    console.log(`SQL generation works: ${sqlWorks ? '✅' : '❌'}`);

    console.log('\nPhase 2 Check Complete.');
}

runPhase2().catch(console.error);
