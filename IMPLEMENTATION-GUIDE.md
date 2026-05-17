# AI-Native ETL Compiler - Implementation Guide

## 🎯 Overview

This guide provides the complete implementation for an AI-native ETL Compiler that uses JSON files as semantic contracts.

## 📐 Architecture

```
Natural Language → Intent → AST → Semantic Analysis → Graph → Validation → Repair → Output
```

All behavior is dynamically derived from JSON resources in `resources/` folder.

## 🗂️ Project Structure

```
src/
├── compiler/
│   ├── pipeline/           # 6-stage compiler pipeline
│   ├── engines/            # Validation, Propagation, Type Inference
│   ├── factories/          # Node, Edge, Field, Handle factories
│   └── repair/             # Error repair system
├── semantic/
│   ├── ResourceLoader.ts   # Load JSON resources
│   ├── ResourceRegistry.ts # Singleton registry
│   └── types/              # TypeScript interfaces for JSON
├── graph/
│   ├── GraphBuilder.ts     # React Flow graph builder
│   ├── DAGValidator.ts     # DAG validation
│   └── LayoutEngine.ts     # Position calculation
├── ai/
│   ├── PromptOrchestrator.ts
│   └── AICompilerClient.ts
└── mcp/
    ├── MCPServer.ts        # MCP protocol implementation
    ├── ResourceProvider.ts # Expose JSON as MCP resources
    └── ToolProvider.ts     # Expose compiler as MCP tools
```

## 🔑 Key Implementation Files

### 1. Resource Registry (Core)

```typescript
// src/semantic/ResourceRegistry.ts
import { SemanticResourceLoader } from './ResourceLoader';

export class ResourceRegistry {
  private static instance: ResourceRegistry;
  private resources: any = null;
  private loader = new SemanticResourceLoader();

  static getInstance(): ResourceRegistry {
    if (!this.instance) this.instance = new ResourceRegistry();
    return this.instance;
  }

  async initialize(): Promise<void> {
    this.resources = await this.loader.loadAll();
  }

  // Accessors for each JSON resource
  getCompilerPipeline() { return this.resources.compilerPipeline; }
  getGraphSpec() { return this.resources.graphSpec; }
  getNodeCatalog() { return this.resources.nodeCatalog; }
  getPropagationRules() { return this.resources.propagationRules; }
  getValidationRules() { return this.resources.validationRules; }
  getPromptTemplates() { return this.resources.promptTemplates; }
  
  // Helper methods
  getNodeDefinition(type: string, subType: string) {
    const catalog = this.getNodeCatalog();
    const collection = catalog[`${type}s`] || catalog[type];
    return type === 'transformer' 
      ? collection.find((n: any) => n.operation === subType)
      : collection.find((n: any) => n.type === subType);
  }

  getPropagationRule(operation: string) {
    return this.getPropagationRules()
      .propagationRules.transformer.operationRules[operation];
  }
}
```

### 2. Compiler Pipeline

```typescript
// src/compiler/pipeline/CompilerPipeline.ts
export class CompilerPipeline {
  async compile(naturalLanguage: string): Promise<CompilationResult> {
    // Stage 1: Intent Extraction
    const intent = await this.intentExtractor.extract(naturalLanguage);
    
    // Stage 2: AST Generation
    const ast = this.astGenerator.generate(intent);
    
    // Stage 3: Semantic Analysis
    const enrichedAST = this.semanticAnalyzer.analyze(ast);
    
    // Stage 4: Graph Compilation
    let graph = this.graphCompiler.compile(enrichedAST);
    
    // Stage 5: Validation
    const validation = this.validator.validate(graph);
    
    // Repair Loop if needed
    if (!validation.valid) {
      const repairResult = await this.repairLoop.repair(graph, validation);
      if (repairResult.success) graph = repairResult.graph;
    }
    
    // Stage 6: Optimization (optional)
    graph = this.optimizer.optimize(graph);
    
    return { success: true, graph };
  }
}
```

### 3. Validation Engine (Dynamic)

```typescript
// src/compiler/engines/ValidationEngine.ts
export class ValidationEngine {
  validate(graph: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Load rules dynamically from validation-rules.json
    errors.push(...this.validateGraph(graph));
    errors.push(...this.validateNodes(graph));
    errors.push(...this.validateEdges(graph));
    errors.push(...this.validateTypes(graph));
    errors.push(...this.validateExpressions(graph));
    errors.push(...this.validateConfigs(graph));
    
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  private validateGraph(graph: any): ValidationError[] {
    const rules = this.registry.getValidationRulesByCategory('graph');
    const errors: ValidationError[] = [];
    
    for (const rule of rules) {
      const validator = this.getGraphValidator(rule.rule);
      const result = validator(graph);
      if (!result.valid && rule.severity === 'error') {
        errors.push({ code: rule.code, rule: rule.rule, message: rule.description });
      }
    }
    return errors;
  }

  private getGraphValidator(ruleName: string) {
    const validators: Record<string, any> = {
      'NO_CYCLES': this.validateNoCycles.bind(this),
      'SOURCE_FIRST': this.validateSourceFirst.bind(this),
      'TARGET_LAST': this.validateTargetLast.bind(this),
      // ... more validators
    };
    return validators[ruleName] || (() => ({ valid: true }));
  }
}
```

### 4. Field Propagation Engine

```typescript
// src/compiler/engines/PropagationEngine.ts
export class PropagationEngine {
  propagate(ast: any): any {
    const sortedNodes = this.topologicalSort(ast);
    
    for (const node of sortedNodes) {
      if (node.type === 'transformer') {
        const propRule = this.registry.getPropagationRule(node.subType);
        const incomingFields = this.getIncomingFields(node, ast);
        
        // Apply transformation based on rule
        switch (propRule.transformation) {
          case 'passthrough': node.fields = incomingFields; break;
          case 'subset': node.fields = this.applySubset(incomingFields, node.config); break;
          case 'reduce': node.fields = propRule.defaultFields; break;
          case 'merge': node.fields = this.applyMerge(incomingFields); break;
          case 'extend': node.fields = this.applyExtend(incomingFields, node.config); break;
        }
      }
    }
    return ast;
  }
}
```

### 5. Node Factory

```typescript
// src/compiler/factories/NodeFactory.ts
export class NodeFactory {
  createNode(type: string, subType: string, config: any): any {
    const nodeDef = this.registry.getNodeDefinition(type, subType);
    if (!nodeDef) throw new Error(`Unknown node: ${type}/${subType}`);
    
    return {
      id: this.generateNodeId(),
      type,
      position: { x: 0, y: 0 },
      data: {
        label: nodeDef.label,
        [this.getSubTypeKey(type)]: subType,
        config: this.buildConfig(nodeDef.config, config),
        outputFields: type === 'source' || type === 'system' ? this.generateFields(nodeDef) : [],
        inputFields: type === 'target' ? this.generateFields(nodeDef) : []
      }
    };
  }

  private getSubTypeKey(type: string): string {
    return { source: 'sourceType', transformer: 'operation', target: 'targetType', system: 'systemType' }[type] || 'type';
  }
}
```

### 6. MCP Integration

```typescript
// src/mcp/MCPServer.ts
export class MCPServer {
  async initialize() {
    await this.registry.initialize();
    
    // Register resources
    this.registerResource('compiler-pipeline', this.registry.getCompilerPipeline());
    this.registerResource('node-catalog', this.registry.getNodeCatalog());
    this.registerResource('validation-rules', this.registry.getValidationRules());
    
    // Register tools
    this.registerTool('compile-etl', this.compileETL.bind(this));
    this.registerTool('validate-graph', this.validateGraph.bind(this));
    this.registerTool('get-node-definition', this.getNodeDefinition.bind(this));
  }

  private async compileETL(params: { naturalLanguage: string }) {
    const pipeline = new CompilerPipeline();
    return await pipeline.compile(params.naturalLanguage);
  }
}
```

## 🔄 Usage Example

```typescript
// Initialize system
const registry = ResourceRegistry.getInstance();
await registry.initialize();

// Compile natural language to graph
const pipeline = new CompilerPipeline();
const result = await pipeline.compile(
  "Load battery.csv, filter where timestamp < current time, save to SQLite"
);

if (result.success) {
  console.log('Generated graph:', result.graph);
}
```

## 🚫 Anti-Patterns to Avoid

### ❌ DON'T: Hardcode node types
```typescript
// BAD
if (node.type === 'csv') { ... }
```

### ✅ DO: Use node catalog
```typescript
// GOOD
const nodeDef = registry.getNodeDefinition('source', 'csv');
if (nodeDef) { ... }
```

### ❌ DON'T: Hardcode validation rules
```typescript
// BAD
if (!node.id || !node.type) throw new Error('Invalid node');
```

### ✅ DO: Use validation-rules.json
```typescript
// GOOD
const rules = registry.getValidationRulesByCategory('node');
for (const rule of rules) {
  const validator = getValidator(rule.rule);
  validator(node);
}
```

### ❌ DON'T: Hardcode field propagation
```typescript
// BAD
if (operation === 'filter') {
  outputFields = inputFields; // passthrough
}
```

### ✅ DO: Use propagation-rules.json
```typescript
// GOOD
const propRule = registry.getPropagationRule(operation);
switch (propRule.transformation) {
  case 'passthrough': outputFields = inputFields; break;
  case 'reduce': outputFields = propRule.defaultFields; break;
}
```

## 📊 Type System

All types derived from `etl-graph-generator-specification.json`:

```typescript
// Type compatibility check
const typeSystem = registry.getGraphSpec().typeSystem;
const compatibleTypes = typeSystem.typeCompatibility[sourceType];
if (!compatibleTypes.includes(targetType)) {
  // Type mismatch
}
```

## 🔧 Expression Grammar

All expressions validated against `expressionGrammar` from spec:

```typescript
const grammar = registry.getGraphSpec().expressionGrammar;
// Field references: {{fieldName}}
// Operators: ==, !=, <, >, <=, >=, &&, ||
// Functions: count, sum, avg, concat, lower, upper
```

## 🎨 ID Conventions

All IDs follow patterns from spec:

- Node IDs: `node_1`, `node_2`, ...
- Edge IDs: `edge_{source}_{sourceHandle}_{target}_{targetHandle}`
- Field IDs: `col_0`, `sql_col_0`, `agg_1`, `out_seq`
- Handles: `output-{fieldId}`, `input-{fieldId}`, `node-source`, `node-target`

## 🔍 Semantic Metadata

Expose metadata for AI agents:

```typescript
export interface GraphMetadata {
  compiledAt: string;
  compiler: string;
  validated: boolean;
  pipelineStages: string[];
  nodeCount: number;
  edgeCount: number;
  topology: 'DAG';
}
```

## 🚀 Production Considerations

1. **Caching**: Cache loaded JSON resources
2. **Validation**: Validate JSON schemas on load
3. **Error Handling**: Implement repair loop with max attempts
4. **Logging**: Log all compiler stages
5. **Metrics**: Track compilation time, validation errors
6. **Testing**: Test against example-patterns.json
7. **MCP**: Expose all resources and tools via MCP protocol

## 📝 Summary

This implementation treats JSON files as:
- ✅ Semantic contracts
- ✅ Compiler specifications
- ✅ Ontology definitions
- ✅ Validation contracts
- ✅ AI reasoning context

NOT as:
- ❌ Simple configuration files
- ❌ Static data
- ❌ Optional metadata

The system is a true compiler with semantic awareness, designed for AI-native workflows and MCP interoperability.
