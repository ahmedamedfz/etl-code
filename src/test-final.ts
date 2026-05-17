import { ExecutionEngine } from './pipeline/ExecutionEngine';
import { PostgresConnector } from './db/PostgresConnector';
import { AIService } from './ai/AIService';

async function runFinalTest() {
    console.log('--- Final QA & Stabilization Check ---');

    const engine = new ExecutionEngine();
    
    // Test DB Recovery & Fallback
    // Purposely use a failing connection to trigger fallback to SQLite
    const failingDb = new PostgresConnector({
        host: 'localhost',
        port: 9999, // wrong port
        user: 'fake',
        database: 'fake'
    });

    const aiService = new AIService({
        apiKey: 'fake-key',
        endpointUrl: 'https://httpbin.org/status/500' // Purposely fail to trigger fallback mapping
    });

    // Test AI Retry & Fallback
    const sourceSchema = [
        { name: 'id', type: 'number' },
        { name: 'full_name', type: 'string' }
    ];
    const targetSchema = [
        { name: 'user_id', type: 'number' },
        { name: 'full_name', type: 'string' }
    ];

    console.log('\nTesting AI Fallback...');
    const aiMapping = await aiService.generateMapping(sourceSchema, targetSchema);
    console.log('AI Mapping obtained (likely via fallback):', aiMapping.explanation);

    // Test Empty CSV handling
    console.log('\nTesting Empty CSV...');
    const emptyContext = {
        csvContent: '',
        tableName: 'users',
        dbConnector: failingDb,
        aiMapping
    };
    const emptyResult = await engine.execute(emptyContext);
    console.log(`Empty CSV properly rejected: ${!emptyResult.success && emptyResult.error === 'CSV is empty' ? '✅' : '❌'}`);

    // Test End-to-end with DB Fallback
    console.log('\nTesting End-to-End Execution with DB Fallback...');
    const validContext = {
        csvContent: 'id,full_name\n1,Alice\n2,Bob',
        tableName: 'users',
        dbConnector: failingDb,
        aiMapping
    };
    const finalResult = await engine.execute(validContext);
    
    console.log('Execution Logs:');
    finalResult.logs.forEach(l => console.log('  ' + l));
    
    console.log(`\nDemo stable offline: ${finalResult.success ? '✅' : '❌'}`);
    console.log(`DB recovery test (Fallback): ${finalResult.logs.some(l => l.includes('falling back to SQLite')) ? '✅' : '❌'}`);
    console.log(`Backup execution logs captured: ${finalResult.logs.length > 0 ? '✅' : '❌'}`);

    console.log('\nFinal Stabilization Check Complete. Ready for Demo.');
}

runFinalTest().catch(console.error);
