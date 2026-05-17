/**
 * Test script to verify MCP configuration functionality
 * Run with: node dist/test-mcp-config.js
 */

import { 
    configureEtlCodeMcpServer, 
    isEtlCodeMcpConfigured, 
    readMcpSettings,
    getMcpSettingsPath,
    removeEtlCodeMcpServer
} from '../utils/mcpConfig';

console.log('=== Testing MCP Configuration ===\n');

// Test 1: Get settings path
console.log('1. MCP Settings Path:');
console.log(`   ${getMcpSettingsPath()}\n`);

// Test 2: Check if already configured
console.log('2. Check if ETL Code MCP is configured:');
const isConfigured = isEtlCodeMcpConfigured();
console.log(`   Already configured: ${isConfigured}\n`);

// Test 3: Configure the MCP server
console.log('3. Configuring ETL Code MCP server...');
try {
    configureEtlCodeMcpServer(3001);
    console.log('   ✓ Configuration successful\n');
} catch (error: any) {
    console.error('   ✗ Configuration failed:', error.message, '\n');
}

// Test 4: Read and display settings
console.log('4. Current MCP Settings:');
const settings = readMcpSettings();
console.log(JSON.stringify(settings, null, 2));
console.log();

// Test 5: Verify configuration
console.log('5. Verify ETL Code MCP is now configured:');
const isNowConfigured = isEtlCodeMcpConfigured();
console.log(`   Configured: ${isNowConfigured}\n`);

// Test 6: Check the specific configuration
if (settings.mcpServers && settings.mcpServers['etl-code-http']) {
    console.log('6. ETL Code MCP Server Configuration:');
    console.log(JSON.stringify(settings.mcpServers['etl-code-http'], null, 2));
    console.log();
}

console.log('=== Test Complete ===');
console.log('\nTo remove the configuration, run:');
console.log('  removeEtlCodeMcpServer()');

// Made with Bob
