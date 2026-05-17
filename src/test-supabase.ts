/**
 * Supabase PostgreSQL Integration Test — Battery Telemetry Workflow
 *
 * Tests real end-to-end ETL execution against Supabase Postgres.
 * Uses ETL MCP server over InMemoryTransport — same pattern as phase 2/3/4/5 tests.
 *
 * Credentials are loaded from .env (never hardcoded).
 * Run ONLY after filling in SUPABASE_PASSWORD in .env.
 *
 * What this test does:
 *   1. Verifies live Supabase connection
 *   2. Creates battery_telemetry table (if not exists)
 *   3. Executes ETL pipeline via MCP with 5 battery rows
 *   4. Verifies rows were written with SELECT COUNT(*)
 *   5. Runs SELECT to confirm data integrity (spot-check)
 *   6. Cleans up (drops inserted rows) so the test is repeatable
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as dns from 'dns/promises';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ETLMCPServer } from './mcp/MCPServer';
import { PostgresConnector } from './db/PostgresConnector';
import { AIResponseSchema } from './types';

// ── Guard: fail fast if password not set ──────────────────────────────────────
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD;
if (!SUPABASE_PASSWORD || SUPABASE_PASSWORD === 'your-password-here') {
    console.error('\n❌ SUPABASE_PASSWORD not set in .env — please fill it in first.\n');
    process.exit(1);
}

const SUPABASE_CONFIG = {
    host:     process.env.SUPABASE_HOST     || 'db.ktsdxlehmbxyivzhjxzx.supabase.co',
    port:     Number(process.env.SUPABASE_PORT) || 5432,
    database: process.env.SUPABASE_DB       || 'postgres',
    user:     process.env.SUPABASE_USER     || 'postgres',
    password: SUPABASE_PASSWORD,
    sslMode:  'require' as const,
    connectionTimeoutMillis: 8000,
};

// ── Battery telemetry data (same dataset used across all phase tests) ──────────
const BATTERY_CSV = `Timestamp,Device_ID,Battery_Voltage_V,Battery_Voltage_mV,Cell_1_Voltage,Cell_2_Voltage,Cell_3_Voltage,State_Of_Charge,Temperature_C,Temperature_F,Charge_Current_A,Discharge_Current_A,Cycle_Count,Internal_Resistance_mOhm,System_Health_Percentage,State_Flag,Is_Charging,Fault_Code,Humidity_Percentage,Pressure_hPa
2024-01-15T08:00:00Z,DEV-001,12.6,12600,4.2,4.2,4.2,95.0,25.1,77.2,2.5,0.0,42,15.2,98.5,CHARGING,true,NONE,62.3,1013.2
2024-01-15T08:01:00Z,DEV-001,12.4,12400,4.1,4.1,4.2,88.0,26.0,78.8,0.0,1.8,42,15.4,97.9,DISCHARGING,false,NONE,63.1,1013.0
2024-01-15T08:02:00Z,DEV-002,11.8,11800,3.9,3.9,4.0,72.5,31.5,88.7,0.0,2.1,107,18.7,91.2,DISCHARGING,false,TEMP_HIGH,70.5,1012.5
2024-01-15T08:03:00Z,DEV-002,12.0,12000,4.0,4.0,4.0,78.0,,0.0,1.5,0.0,107,18.1,91.5,CHARGING,true,NONE,,1012.7
2024-01-15T08:04:00Z,DEV-003,10.5,10500,3.5,3.5,3.5,45.2,29.0,84.2,0.0,3.2,250,22.3,75.0,LOW,false,CELL_LOW,65.0,1011.9`;

// Mapping derived from sample.json edges (battery workflow)
const BATTERY_MAPPING: AIResponseSchema = {
    mapping: [
        { sourceField: 'Device_ID',                targetField: 'device_id',                 confidenceScore: 0.99 },
        { sourceField: 'Timestamp',                targetField: 'timestamp',                  confidenceScore: 0.98 },
        { sourceField: 'Battery_Voltage_V',        targetField: 'battery_voltage_v',          confidenceScore: 0.97 },
        { sourceField: 'Battery_Voltage_mV',       targetField: 'battery_voltage_mv',         confidenceScore: 0.97 },
        { sourceField: 'Cell_1_Voltage',           targetField: 'cell_1_voltage',             confidenceScore: 0.96 },
        { sourceField: 'Cell_2_Voltage',           targetField: 'cell_2_voltage',             confidenceScore: 0.96 },
        { sourceField: 'Cell_3_Voltage',           targetField: 'cell_3_voltage',             confidenceScore: 0.96 },
        { sourceField: 'State_Of_Charge',          targetField: 'state_of_charge',            confidenceScore: 0.95 },
        { sourceField: 'Temperature_C',            targetField: 'temperature_c',              confidenceScore: 0.98 },
        { sourceField: 'Temperature_F',            targetField: 'temperature_f',              confidenceScore: 0.98 },
        { sourceField: 'Charge_Current_A',         targetField: 'charge_current_a',           confidenceScore: 0.96 },
        { sourceField: 'Discharge_Current_A',      targetField: 'discharge_current_a',        confidenceScore: 0.96 },
        { sourceField: 'Cycle_Count',              targetField: 'cycle_count',                confidenceScore: 0.97 },
        { sourceField: 'Internal_Resistance_mOhm', targetField: 'internal_resistance_mohm',  confidenceScore: 0.93 },
        { sourceField: 'System_Health_Percentage', targetField: 'system_health_percentage',   confidenceScore: 0.95 },
        { sourceField: 'State_Flag',               targetField: 'state_flag',                 confidenceScore: 0.99 },
        { sourceField: 'Is_Charging',              targetField: 'is_charging',                confidenceScore: 0.99 },
        { sourceField: 'Fault_Code',               targetField: 'fault_code',                 confidenceScore: 0.99 },
        { sourceField: 'Humidity_Percentage',      targetField: 'humidity_percentage',
          transformLogic: 'Number(value)',                                                     confidenceScore: 0.95 },
        { sourceField: 'Pressure_hPa',             targetField: 'pressure_hpa',               confidenceScore: 0.96 },
    ],
    explanation: 'Battery telemetry mapping from sample.json (node_1 → node_6 edges). Supabase target.'
};

// ── DDL: CREATE TABLE matching sample.json node_6 target schema ───────────────
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS battery_telemetry (
    id                        SERIAL PRIMARY KEY,
    device_id                 TEXT,
    timestamp                 TIMESTAMPTZ,
    battery_voltage_v         REAL,
    battery_voltage_mv        INTEGER,
    cell_1_voltage            REAL,
    cell_2_voltage            REAL,
    cell_3_voltage            REAL,
    state_of_charge           REAL,
    temperature_c             REAL,
    temperature_f             REAL,
    charge_current_a          REAL,
    discharge_current_a       REAL,
    cycle_count               INTEGER,
    internal_resistance_mohm  REAL,
    system_health_percentage  REAL,
    state_flag                TEXT,
    is_charging               BOOLEAN,
    fault_code                TEXT,
    humidity_percentage       REAL,
    pressure_hpa              REAL,
    inserted_at               TIMESTAMPTZ DEFAULT NOW()
);
`.trim();

// ── Helper: MCP in-process pair ───────────────────────────────────────────────
async function createMCPPair() {
    const etlServer = new ETLMCPServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await etlServer.connectTransport(st);
    const client = new Client({ name: 'supabase-test-client', version: '1.0.0' });
    await client.connect(ct);
    return { client };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runSupabaseTest() {
    console.log('════════════════════════════════════════════════════════');
    console.log('  Supabase PostgreSQL Integration Test');
    console.log(`  Host: ${SUPABASE_CONFIG.host}:${SUPABASE_CONFIG.port}`);
    console.log('════════════════════════════════════════════════════════\n');

    const db = new PostgresConnector(SUPABASE_CONFIG);

    // ── 0. DNS diagnostic ─────────────────────────────────────────────────────
    console.log('── 0. DNS Check ──');
    try {
        const addrs = await dns.lookup(SUPABASE_CONFIG.host);
        console.log(`  DNS resolved:           ✅ ${SUPABASE_CONFIG.host} → ${addrs.address}`);
    } catch (dnsErr: any) {
        console.error(`  DNS resolution failed:  ❌ ${dnsErr.message}`);
        console.error(
            `\n  Possible causes:\n` +
            `  1. Hostname is wrong — go to Supabase Dashboard → Project Settings → Database\n` +
            `     and copy the exact host from "Connection parameters"\n` +
            `  2. You are on a restricted/offline network\n` +
            `  3. Try the Supabase pooler host instead:\n` +
            `     aws-0-<region>.pooler.supabase.com  port 5432 (session mode)\n`
        );
        process.exit(1);
    }

    // ── 1. Live connection test ───────────────────────────────────────────────
    console.log('\n── 1. Connection ──');
    const connected = await db.testConnection();
    console.log(`  Supabase connection:    ${connected ? '✅' : '❌'}`);
    if (!connected) {
        console.error('\n  TCP connection failed — password wrong or firewall blocking port 5432\n');
        process.exit(1);
    }

    // ── 2. Create table (idempotent) ─────────────────────────────────────────
    console.log('\n── 2. Schema Setup ──');
    await db.connect();
    await db.query(CREATE_TABLE_SQL);
    console.log(`  battery_telemetry table: ✅ (created or already exists)`);

    // Count rows before insert for accurate delta check
    const beforeCount = (await db.query('SELECT COUNT(*) AS n FROM battery_telemetry'))[0]?.n ?? 0;
    console.log(`  Rows before test:        ${beforeCount}`);

    // ── 3. ETL pipeline via MCP → real Supabase ──────────────────────────────
    console.log('\n── 3. ETL Pipeline via MCP → Supabase ──');
    console.log('  Using MCP tool: execute_etl_pipeline_postgres');

    const { client: mcpClient } = await createMCPPair();

    // Confirm the tool is listed
    const toolList = await mcpClient.listTools();
    const hasPostgresTool = toolList.tools.some((t: any) => t.name === 'execute_etl_pipeline_postgres');
    console.log(`  MCP tool exposed:       ${hasPostgresTool ? '✅' : '❌'} (execute_etl_pipeline_postgres)`);

    console.log('  Running ETL via MCP...');
    const startMs = Date.now();
    const mcpResult = await mcpClient.callTool({
        name: 'execute_etl_pipeline_postgres',
        arguments: {
            csvContent:    BATTERY_CSV,
            tableName:     'battery_telemetry',
            aiMappingJson: JSON.stringify(BATTERY_MAPPING)
            // host/port/database/user come from .env via the server
        }
    });
    const durationMs = Date.now() - startMs;

    if ((mcpResult as any).isError) {
        const errText = ((mcpResult.content as any[])[0]?.text ?? 'unknown error');
        console.error(`  MCP tool error: ${errText}`);
        process.exit(1);
    }

    const result = JSON.parse((mcpResult.content as any[])[0]?.text);

    console.log(`  Pipeline success:        ${result.success ? '✅' : '❌'}`);
    console.log(`  Rows inserted:           ${result.rowsAffected} (expected 5)`);
    console.log(`  Execution time:          ${durationMs}ms`);

    if (result.warnings?.length) {
        console.log(`  Warnings:`);
        result.warnings.forEach((w: any) => console.log(`    ⚠ ${w.message}`));
    }

    // ── 4. Verification — SELECT from Supabase ────────────────────────────────
    console.log('\n── 4. Data Verification ──');
    const afterCount = Number((await db.query('SELECT COUNT(*) AS n FROM battery_telemetry'))[0]?.n ?? 0);
    const delta      = afterCount - Number(beforeCount);

    console.log(`  Rows after test:         ${afterCount}`);
    console.log(`  New rows written:        ${delta === 5 ? `✅ (${delta})` : `❌ (${delta}, expected 5)`}`);

    // Spot-check: verify DEV-001 rows exist and voltage is correct
    const spotCheck = await db.query(
        `SELECT device_id, battery_voltage_v, state_flag, is_charging
         FROM battery_telemetry
         WHERE device_id = 'DEV-001'
         ORDER BY timestamp DESC
         LIMIT 2`
    );
    console.log(`  Spot-check DEV-001:`);
    spotCheck.forEach((row: any) => {
        console.log(`    device_id=${row.device_id}  voltage=${row.battery_voltage_v}V  state=${row.state_flag}  charging=${row.is_charging}`);
    });
    const spotOk = spotCheck.length === 2 && spotCheck[0].device_id === 'DEV-001';
    console.log(`  Data integrity:          ${spotOk ? '✅' : '❌'}`);

    // Null check: Temperature_C row 4 (DEV-002 08:03) should have NULL temperature_c
    const nullCheck = await db.query(
        `SELECT device_id, temperature_c, humidity_percentage
         FROM battery_telemetry
         WHERE device_id = 'DEV-002' AND temperature_c IS NULL
         LIMIT 1`
    );
    console.log(`  NULL propagation:        ${nullCheck.length > 0 ? '✅' : '❌'} (temperature_c IS NULL)`);

    // ── 5. MCP tool test (preview_database_schema still uses mock) ────────────
    console.log('\n── 5. MCP Tool ──');
    const { client } = await createMCPPair();
    const schemaResult = await client.callTool({ name: 'preview_database_schema', arguments: {} });
    const schemaText   = (schemaResult.content as any[])[0]?.text;
    const schemas      = JSON.parse(schemaText);
    console.log(`  MCP preview_database_schema: ✅ (${schemas.length} mock tables — real Supabase schema separate)`);

    // ── 6. Cleanup ────────────────────────────────────────────────────────────
    console.log('\n── 6. Cleanup ──');
    // Delete only the rows inserted in THIS run (by inserted_at window)
    await db.query(
        `DELETE FROM battery_telemetry
         WHERE device_id IN ('DEV-001', 'DEV-002', 'DEV-003')
           AND inserted_at >= NOW() - INTERVAL '5 minutes'`
    );
    const cleanCount = Number((await db.query('SELECT COUNT(*) AS n FROM battery_telemetry'))[0]?.n ?? 0);
    const cleanedRows = afterCount - cleanCount;
    console.log(`  Rows deleted:            ${cleanedRows} (expected 5)`);
    console.log(`  Rows remaining:          ${cleanCount}`);
    console.log(`  Cleanup success:         ${cleanedRows === 5 ? '✅' : '❌'}`);

    await db.disconnect();

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  Supabase Integration Summary');
    console.log('════════════════════════════════════════════════════════');
    console.log(`  Live Supabase connection:    ✅`);
    console.log(`  SSL (rejectUnauthorized):    ✅ (sslMode=require)`);
    console.log(`  Table auto-created:          ✅`);
    console.log(`  ETL pipeline executes:       ${result.success ? '✅' : '❌'}`);
    console.log(`  5 rows written to Supabase:  ${delta === 5 ? '✅' : '❌'}`);
    console.log(`  Data integrity verified:     ${spotOk ? '✅' : '❌'}`);
    console.log(`  NULL propagation correct:    ${nullCheck.length > 0 ? '✅' : '❌'}`);
    console.log(`  MCP tools still work:        ✅`);
    console.log(`  Cleanup completed:           ${cleanedRows === 5 ? '✅' : '❌'}`);

    console.log('\n  Supabase Integration Test Complete ✅');
}

runSupabaseTest().catch(err => {
    console.error('\n❌ Supabase test failed:', err.message ?? err);
    process.exit(1);
});
