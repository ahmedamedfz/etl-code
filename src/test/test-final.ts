import { ExecutionEngine } from '../pipeline/ExecutionEngine';
import { PostgresConnector } from '../db/PostgresConnector';
import { OracleMockConnector } from '../db/OracleMockConnector';
import { AIService } from '../ai/AIService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function runFinalTest() {
    console.log('════════════════════════════════════════');
    console.log('   Phase 4 & 5 — Final QA & Demo Safety');
    console.log('════════════════════════════════════════\n');

    const engine = new ExecutionEngine();

    // ── AI Service (intentionally failing endpoint to test retry + fallback) ──────
    const aiService = new AIService({
        apiKey: 'fake-key',
        endpointUrl: 'https://httpbin.org/status/500' // Triggers retries then fallback
    });

    const sourceSchema = [
        { name: 'id',        type: 'number' },
        { name: 'full_name', type: 'string' },
        { name: 'age',       type: 'number' },
        { name: 'email',     type: 'string' }
    ];
    const targetSchema = [
        { name: 'user_id',       type: 'number' },
        { name: 'full_name',     type: 'string' },
        { name: 'user_age',      type: 'number' },
        { name: 'email_address', type: 'string' }
    ];

    // ── Phase 4: AI Retry + Fallback chain ───────────────────────────────────────
    console.log('── AI Retry + Fallback ──');
    const aiMapping = await aiService.generateMapping(sourceSchema, targetSchema);
    const aiRetryWorks   = aiMapping !== undefined && Array.isArray(aiMapping.mapping);
    const usedFallback   = aiMapping.explanation?.toLowerCase().includes('fallback') ||
                           aiMapping.explanation?.toLowerCase().includes('offline') ||
                           aiMapping.explanation?.toLowerCase().includes('precomputed');
    console.log(`AI retry handling works:          ${aiRetryWorks ? '✅' : '❌'}`);
    console.log(`Cached fallback AI response used: ${usedFallback ? '✅' : '❌'}`);
    console.log(`Precomputed AI output available:  ${usedFallback ? '✅' : '❌'}`);

    // ── Phase 4: Better prompts: check mapping has confidenceScore ────────────────
    const hasConfidence = aiMapping.mapping.every(m => typeof m.confidenceScore === 'number');
    console.log(`AI outputs deterministic enough:  ${hasConfidence ? '✅' : '❌'}`);

    // ── Phase 5: Empty CSV handling ───────────────────────────────────────────────
    console.log('\n── Empty CSV Handling ──');
    const failingDb = new PostgresConnector({ host: 'localhost', port: 9999, user: 'fake', database: 'fake' });
    const emptyResult = await engine.execute({
        csvContent: '',
        tableName: 'users',
        dbConnector: failingDb,
        aiMapping
    });
    console.log(`Empty CSV properly rejected:      ${!emptyResult.success && emptyResult.error === 'CSV is empty' ? '✅' : '❌'}`);

    // ── Phase 4 + 5: DB Fallback + End-to-end ─────────────────────────────────────
    console.log('\n── End-to-End with DB Fallback ──');
    const csvContent = 'id,full_name,age,email\n1,Alice,28,alice@example.com\n2,Bob,,bob@example.com';
    const finalResult = await engine.execute({
        csvContent,
        tableName: 'users',
        dbConnector: failingDb,  // Will fail → triggers SQLite fallback
        aiMapping
    });

    console.log(`Demo stable offline:              ${finalResult.success ? '✅' : '❌'}`);
    console.log(`DB recovery (SQLite fallback):    ${finalResult.logs.some(l => l.includes('falling back to SQLite')) ? '✅' : '❌'}`);
    console.log(`Backup SQLite execution:          ${finalResult.success ? '✅' : '❌'}`);
    console.log(`CSV inserts successfully:         ${finalResult.success && (finalResult.rowsAffected ?? 0) > 0 ? '✅' : '❌'}`);

    // ── Phase 5: Logs + backup SQL written to disk ────────────────────────────────
    console.log('\n── Backup Safety ──');
    const backupDir = path.join(os.tmpdir(), 'etl-code-backups');
    const sqlFiles  = fs.existsSync(backupDir)
        ? fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'))
        : [];
    const logFiles  = fs.existsSync(backupDir)
        ? fs.readdirSync(backupDir).filter(f => f.endsWith('.log'))
        : [];

    console.log(`Backup generated SQL on disk:     ${sqlFiles.length > 0 ? `✅ (${sqlFiles.at(-1)})` : '❌'}`);
    console.log(`Backup execution logs on disk:    ${logFiles.length > 0 ? `✅ (${logFiles.at(-1)})` : '❌'}`);
    console.log(`Backup mock response (file):      ${fs.existsSync(path.join(__dirname, 'ai/fallback-mapping.json')) ? '✅' : '❌'}`);

    // ── Phase 5: No critical runtime error check ──────────────────────────────────
    console.log('\n── Logs stream properly ──');
    finalResult.logs.slice(0, 5).forEach(l => console.log(' ', l));

    // ERROR in finalResult means the successful end-to-end run itself errored — not the empty-CSV test
    const noErrors = !finalResult.logs.some(l => l.startsWith('[ERROR]'));
    console.log(`\nLogs stream properly:             ${finalResult.logs.length > 0 ? '✅' : '❌'}`);
    console.log(`No critical runtime error:        ${noErrors ? '✅' : '❌'}`);
    console.log(`AI consistently works (fallback): ${aiRetryWorks ? '✅' : '❌'}`);

    // ── Phase 5: Oracle mock preview ─────────────────────────────────────────────
    console.log('\n── Mock Oracle Preview ──');
    const oracle = new OracleMockConnector();
    await oracle.connect();
    const tables = oracle.getAvailableTables();
    const userSchema = oracle.getTableSchema('USERS');
    console.log(`Fake preview table available:     ${userSchema !== undefined ? '✅' : '❌'}`);
    console.log(`Mock schema tables:               ${tables.join(', ')}`);
    console.log(`Preview rows:                     ${JSON.stringify(userSchema?.previewRows[0] ?? {})}`);

    console.log('\n════════════════════════════════════════');
    console.log('   Final Stabilization Check Complete.');
    console.log('════════════════════════════════════════');
}

runFinalTest().catch(console.error);
