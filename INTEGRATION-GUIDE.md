# JSON-Driven Architecture Integration Guide

## 🎯 Overview

This guide explains how to integrate the JSON-driven semantic architecture into your existing ETL codebase. The integration enhances your current system with dynamic behavior derived from JSON knowledge files.

## 📦 What's Been Added

### New Files Created

```
src/
├── semantic/
│   ├── ResourceLoader.ts       # Loads JSON resources
│   └── ResourceRegistry.ts     # Singleton registry for resources
├── compiler/
│   └── ValidationEngine.ts     # Dynamic validation from JSON
└── mcp/
    └── WorkflowGeneratorV2.ts  # JSON-driven workflow generator
```

### JSON Resources (Already in `resources/`)

- `compiler-pipeline.json` - Pipeline stages specification
- `etl-graph-generator-specification.json` - Graph schema & conventions
- `node-catalog.json` - Node type definitions
- `field-propagation-rules.json` - Field propagation semantics
- `validation-rules.json` - Validation contracts
- `prompt-templates.json` - AI prompt templates
- `example-patterns.json` - Few-shot examples

## 🔄 Migration Path

### Phase 1: Initialize Semantic Resources

**Update `src/extension.ts`:**

```typescript
import { ResourceRegistry } from './semantic/ResourceRegistry';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize semantic resources at startup
    const registry = ResourceRegistry.getInstance();
    await registry.initialize();
    
    console.log('Semantic resources loaded');
    
    // ... rest of your activation code
}
```

### Phase 2: Enhance WorkflowGenerator

**Option A: Gradual Migration (Recommended)**

Keep existing `WorkflowGenerator.ts` and use `WorkflowGeneratorV2.ts` for new features:

```typescript
// In src/mcp/MCPServer.ts
import { WorkflowGeneratorV2 } from './WorkflowGeneratorV2';
import { generateWorkflowFromDescription } from './WorkflowGenerator'; // fallback

async generate_etl_workflow(args: { description: string }) {
    try {
        // Try V2 (JSON-driven)
        const generatorV2 = new WorkflowGeneratorV2();
        return await generatorV2.generateWorkflow(args.description);
    } catch (error) {
        // Fallback to V1
        console.warn('V2 failed, using V1 fallback', error);
        return generateWorkflowFromDescription(args.description);
    }
}
```

**Option B: Full Migration**

Replace hardcoded logic in `WorkflowGenerator.ts` with JSON-driven approach:

```typescript
// Before (hardcoded)
if (node.type === 'csv') {
    // hardcoded CSV logic
}

// After (JSON-driven)
const nodeDef = registry.getNodeDefinition('source', 'csv');
if (nodeDef) {
    // use nodeDef.config, nodeDef.label, etc.
}
```

### Phase 3: Add Validation

**Integrate ValidationEngine into your workflow:**

```typescript
// In src/mcp/WorkflowGeneratorV2.ts or MCPServer.ts
import { ValidationEngine } from '../compiler/ValidationEngine';

async generateWorkflow(description: string) {
    const workflow = await this.buildWorkflow(description);
    
    // Validate using JSON rules
    const validator = new ValidationEngine();
    const validation = await validator.validate(workflow);
    
    if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
        // Handle errors or attempt repair
    }
    
    return workflow;
}
```

### Phase 4: Enhance AIService with Prompt Templates

**Update `src/ai/AIService.ts`:**

```typescript
import { ResourceRegistry } from '../semantic/ResourceRegistry';

export class AIService {
    private registry: ResourceRegistry;
    
    constructor(config: AIServiceConfig) {
        this.apiKey = config.apiKey;
        this.endpointUrl = config.endpointUrl || 'https://api.example.com';
        this.registry = ResourceRegistry.getInstance();
    }
    
    async generateMapping(sourceSchema: any, targetSchema: any) {
        // Use prompt template from JSON
        const promptTemplates = this.registry.getPromptTemplates();
        const template = promptTemplates.fieldMapper;
        
        const prompt = template.userPromptTemplate
            .replace('{sourceFields}', JSON.stringify(sourceSchema))
            .replace('{targetFields}', JSON.stringify(targetSchema));
        
        // ... rest of AI call
    }
}
```

### Phase 5: Update MCP Server

**Enhance `src/mcp/MCPServer.ts` to expose semantic resources:**

```typescript
import { ResourceRegistry } from '../semantic/ResourceRegistry';

export class MCPServer {
    private registry: ResourceRegistry;
    
    async initialize() {
        this.registry = ResourceRegistry.getInstance();
        await this.registry.initialize();
        
        // Expose JSON resources as MCP resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: [
                {
                    uri: 'etl://resources/node-catalog',
                    name: 'Node Catalog',
                    description: 'Available ETL node types',
                    mimeType: 'application/json'
                },
                {
                    uri: 'etl://resources/validation-rules',
                    name: 'Validation Rules',
                    description: 'Graph validation contracts',
                    mimeType: 'application/json'
                },
                // ... more resources
            ]
        }));
        
        // Expose resources content
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            if (request.params.uri === 'etl://resources/node-catalog') {
                return {
                    contents: [{
                        uri: request.params.uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(this.registry.getNodeCatalog(), null, 2)
                    }]
                };
            }
            // ... handle other resources
        });
    }
}
```

## 🔑 Key Integration Points

### 1. Node Creation

**Before:**
```typescript
// Hardcoded in WorkflowGenerator.ts
nodes.push({
    id: 'node_1',
    type: 'source',
    data: {
        label: 'New CSV Source',  // hardcoded
        sourceType: 'csv',
        config: { /* hardcoded defaults */ }
    }
});
```

**After:**
```typescript
// Dynamic from node-catalog.json
const nodeDef = registry.getNodeDefinition('source', 'csv');
nodes.push({
    id: generateNodeId(),  // from ID conventions
    type: 'source',
    data: {
        label: nodeDef.label,  // from catalog
        sourceType: 'csv',
        config: buildConfig(nodeDef.config)  // from catalog schema
    }
});
```

### 2. Validation

**Before:**
```typescript
// Hardcoded validation
if (!node.id || !node.type) {
    throw new Error('Invalid node');
}
```

**After:**
```typescript
// Dynamic from validation-rules.json
const validator = new ValidationEngine();
const result = await validator.validate(workflow);
if (!result.valid) {
    // Handle errors from JSON rules
}
```

### 3. Field Propagation

**Before:**
```typescript
// Hardcoded logic
if (operation === 'filter') {
    outputFields = inputFields;  // passthrough
}
```

**After:**
```typescript
// Dynamic from field-propagation-rules.json
const propRule = registry.getPropagationRule(operation);
switch (propRule.transformation) {
    case 'passthrough':
        outputFields = inputFields;
        break;
    case 'reduce':
        outputFields = propRule.defaultFields;
        break;
    // ... other transformations
}
```

### 4. Type Checking

**Before:**
```typescript
// Manual type checking
if (sourceType !== targetType) {
    console.warn('Type mismatch');
}
```

**After:**
```typescript
// Use type system from graph spec
const compatible = registry.areTypesCompatible(sourceType, targetType);
if (!compatible) {
    // Suggest type coercion
}
```

## 📊 Benefits of Integration

### ✅ Dynamic Behavior
- Add new node types by updating `node-catalog.json`
- Add validation rules by updating `validation-rules.json`
- No code changes required for new node types

### ✅ Consistency
- Single source of truth for node definitions
- Consistent validation across all components
- Standardized ID and handle conventions

### ✅ AI-Native
- Semantic metadata for AI agents
- MCP-compatible resource exposure
- Structured prompts from templates

### ✅ Maintainability
- Separation of concerns
- Easy to test (validate JSON schemas)
- Clear contracts between components

## 🚀 Usage Examples

### Example 1: Create Node Dynamically

```typescript
import { ResourceRegistry } from './semantic/ResourceRegistry';

const registry = ResourceRegistry.getInstance();
await registry.initialize();

// Get all available source types
const sourceTypes = registry.getNodeTypes('source');
console.log('Available sources:', sourceTypes);
// Output: ['csv', 'excel', 'sqlite', 'postgres', 'mysql', 'rest-api']

// Create a node
const csvDef = registry.getNodeDefinition('source', 'csv');
const node = {
    id: 'node_1',
    type: 'source',
    data: {
        label: csvDef.label,
        sourceType: 'csv',
        config: {
            filePath: '/path/to/data.csv',
            delimiter: csvDef.config.delimiter.default,
            skipRows: csvDef.config.skipRows.default
        }
    }
};
```

### Example 2: Validate Workflow

```typescript
import { ValidationEngine } from './compiler/ValidationEngine';

const validator = new ValidationEngine();
const result = await validator.validate(workflow);

if (!result.valid) {
    console.error('Validation failed:');
    for (const error of result.errors) {
        console.error(`[${error.code}] ${error.message}`);
        if (error.suggestion) {
            console.error(`  Suggestion: ${error.suggestion}`);
        }
    }
}
```

### Example 3: Check Type Compatibility

```typescript
const registry = ResourceRegistry.getInstance();

const compatible = registry.areTypesCompatible('integer', 'float');
console.log('integer → float:', compatible);  // true

const typeSystem = registry.getTypeSystem();
console.log('Compatible types for integer:', typeSystem.typeCompatibility.integer);
// Output: ['integer', 'number', 'float', 'any']
```

## 🔧 Testing Integration

### Test 1: Resource Loading

```typescript
import { ResourceRegistry } from './semantic/ResourceRegistry';

async function testResourceLoading() {
    const registry = ResourceRegistry.getInstance();
    await registry.initialize();
    
    console.log('✓ Resources loaded');
    console.log('✓ Node catalog:', Object.keys(registry.getNodeCatalog()));
    console.log('✓ Validation rules:', Object.keys(registry.getValidationRules()));
}
```

### Test 2: Workflow Generation

```typescript
import { WorkflowGeneratorV2 } from './mcp/WorkflowGeneratorV2';

async function testWorkflowGeneration() {
    const generator = new WorkflowGeneratorV2();
    const workflow = await generator.generateWorkflow(
        'Load battery.csv and save to SQLite'
    );
    
    console.log('✓ Workflow generated');
    console.log('  Nodes:', workflow.nodes.length);
    console.log('  Edges:', workflow.edges.length);
}
```

### Test 3: Validation

```typescript
import { ValidationEngine } from './compiler/ValidationEngine';

async function testValidation() {
    const validator = new ValidationEngine();
    const result = await validator.validate(workflow);
    
    console.log('✓ Validation complete');
    console.log('  Valid:', result.valid);
    console.log('  Errors:', result.errors.length);
    console.log('  Warnings:', result.warnings.length);
}
```

## 📝 Migration Checklist

- [ ] Add `src/semantic/` folder with ResourceLoader and ResourceRegistry
- [ ] Add `src/compiler/` folder with ValidationEngine
- [ ] Initialize ResourceRegistry in `extension.ts` activation
- [ ] Update WorkflowGenerator to use node catalog (gradual or full)
- [ ] Integrate ValidationEngine into workflow generation
- [ ] Update AIService to use prompt templates
- [ ] Enhance MCP server to expose semantic resources
- [ ] Add tests for resource loading
- [ ] Add tests for validation
- [ ] Update documentation

## 🎯 Next Steps

1. **Start with Phase 1**: Initialize resources in extension activation
2. **Test resource loading**: Verify all JSON files load correctly
3. **Gradual migration**: Use V2 generator alongside V1
4. **Add validation**: Integrate ValidationEngine
5. **Enhance AI**: Use prompt templates
6. **Expose via MCP**: Make resources available to AI agents

## 🚫 Common Pitfalls

### ❌ Don't: Hardcode node types
```typescript
if (nodeType === 'csv') { /* ... */ }
```

### ✅ Do: Use node catalog
```typescript
const nodeDef = registry.getNodeDefinition('source', 'csv');
if (nodeDef) { /* ... */ }
```

### ❌ Don't: Hardcode validation rules
```typescript
if (!node.id) throw new Error('Missing ID');
```

### ✅ Do: Use validation engine
```typescript
const result = await validator.validate(workflow);
```

### ❌ Don't: Hardcode field propagation
```typescript
if (op === 'filter') outputFields = inputFields;
```

### ✅ Do: Use propagation rules
```typescript
const rule = registry.getPropagationRule(op);
```

## 📚 Additional Resources

- `IMPLEMENTATION-GUIDE.md` - Full implementation details
- `resources/` - JSON knowledge files
- `src/semantic/` - Resource loading system
- `src/compiler/` - Validation and compilation engines

## 🤝 Support

The integration is designed to be gradual and non-breaking. Your existing code continues to work while you migrate to the JSON-driven architecture incrementally.

For questions or issues, refer to the JSON files as the authoritative source of truth for:
- Node types and configurations
- Validation rules
- Field propagation behavior
- Type system
- Expression grammar
- ID and handle conventions