import { ExecutionEngine } from './pipeline/ExecutionEngine';
import { OracleMockConnector } from './db/OracleMockConnector';

async function runPhase3() {
    console.log('--- Phase 3 Milestone Check ---');

    const engine = new ExecutionEngine();
    const connector = new OracleMockConnector();

    const context = {
        // age has a null value and 'missingField' does not exist in CSV — both trigger warnings
        csvContent: 'id,first_name,age,email\n1,John,30,john@example.com\n2,Jane,,jane@example.com',
        tableName: 'users',
        dbConnector: connector,
        aiMapping: {
            mapping: [
                { sourceField: 'id', targetField: 'user_id', confidenceScore: 0.99 },
                { sourceField: 'first_name', targetField: 'name', transformLogic: 'value.toUpperCase()', confidenceScore: 0.95 },
                { sourceField: 'age', targetField: 'user_age', confidenceScore: 0.9 },
                { sourceField: 'email', targetField: 'email_address', confidenceScore: 1.0 },
                { sourceField: 'missingField', targetField: 'ghost_col', confidenceScore: 0.5 } // low confidence + not in CSV
            ],
            explanation: 'Mapped based on semantic similarity. Warning: age has nulls.'
        }
    };

    const result = await engine.execute(context);

    console.log('\n--- Execution Logs ---');
    result.logs.forEach(l => console.log(' ', l));

    console.log('\n--- Warnings ---');
    result.warnings.forEach(w => console.log(' ⚠', w.message));

    console.log('\n--- Milestone Checks ---');
    console.log(`CSV inserts successfully: ${result.success && result.rowsAffected === 2 ? '✅' : '❌'}`);
    console.log(`Logs stream properly: ${result.logs && result.logs.length > 0 ? '✅' : '❌'}`);
    console.log(`AI explanations visible: ${result.logs.some(l => l.includes('Explanation')) ? '✅' : '❌'}`);
    console.log(`Warning generation works: ${result.warnings.length > 0 ? '✅' : '❌'}`);
    console.log(`Compatibility analysis (null detection): ${result.warnings.some(w => w.message.includes('NULL')) ? '✅' : '❌'}`);
    console.log(`Compatibility analysis (missing field): ${result.warnings.some(w => w.message.includes('not found')) ? '✅' : '❌'}`);
    console.log(`Compatibility analysis (low confidence): ${result.warnings.some(w => w.message.includes('confidence')) ? '✅' : '❌'}`);

    console.log('\nPhase 3 Check Complete.');
}

runPhase3().catch(console.error);

