import { ExecutionEngine } from './pipeline/ExecutionEngine';
import { OracleMockConnector } from './db/OracleMockConnector';

async function runPhase3() {
    console.log('--- Phase 3 Milestone Check ---');

    const engine = new ExecutionEngine();
    const connector = new OracleMockConnector();

    const context = {
        csvContent: 'id,first_name,age,email\n1,John,30,john@example.com\n2,Jane,,jane@example.com',
        tableName: 'users',
        dbConnector: connector,
        aiMapping: {
            mapping: [
                { sourceField: 'id', targetField: 'user_id', confidenceScore: 0.99 },
                { sourceField: 'first_name', targetField: 'name', transformLogic: 'value.toUpperCase()', confidenceScore: 0.95 },
                { sourceField: 'age', targetField: 'user_age', confidenceScore: 0.9 },
                { sourceField: 'email', targetField: 'email_address', confidenceScore: 1.0 }
            ],
            explanation: 'Mapped based on semantic similarity. Warning: age has nulls.'
        }
    };

    const result = await engine.execute(context);
    
    console.log('Execution Result:', result);

    console.log(`CSV inserts successfully: ${result.success && result.rowsAffected === 2 ? '✅' : '❌'}`);
    console.log(`Logs stream properly: ${result.logs && result.logs.length > 0 ? '✅' : '❌'}`);
    console.log(`AI explanations visible: ${result.logs.some(l => l.includes('Explanation')) ? '✅' : '❌'}`);

    console.log('\nPhase 3 Check Complete.');
}

runPhase3().catch(console.error);
