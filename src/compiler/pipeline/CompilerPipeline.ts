/**
 * Compiler Pipeline
 * 6-stage ETL compilation pipeline following IMPLEMENTATION-GUIDE.md
 * 
 * Pipeline Stages:
 * 1. Intent Extraction - Parse natural language to structured intent
 * 2. AST Generation - Build abstract syntax tree
 * 3. Semantic Analysis - Enrich AST with semantic information
 * 4. Graph Compilation - Convert AST to React Flow graph
 * 5. Validation - Validate graph against rules
 * 6. Optimization - Optimize graph structure (optional)
 */

import { ResourceRegistry } from '../../semantic/ResourceRegistry';
import { ValidationEngine } from '../ValidationEngine';
import { WorkflowJSON } from '../../mcp/WorkflowGenerator';

export interface CompilationResult {
  success: boolean;
  graph?: WorkflowJSON;
  errors?: string[];
  warnings?: string[];
  metadata?: CompilationMetadata;
}

export interface CompilationMetadata {
  compiledAt: string;
  compiler: string;
  validated: boolean;
  pipelineStages: string[];
  nodeCount: number;
  edgeCount: number;
  topology: 'DAG';
}

export interface Intent {
  sourceType: string;
  sourceConfig: any;
  transformations: TransformationIntent[];
  targetType: string;
  targetConfig: any;
  systemNodes: SystemNodeIntent[];
}

export interface TransformationIntent {
  operation: string;
  config: any;
}

export interface SystemNodeIntent {
  type: string;
  config: any;
}

export interface ASTNode {
  id: string;
  type: 'source' | 'transformer' | 'target' | 'system';
  subType: string;
  config: any;
  fields?: any[];
  connections?: string[];
}

export class CompilerPipeline {
  private registry: ResourceRegistry;
  private validator: ValidationEngine;
  private nodeCounter = 0;

  constructor() {
    this.registry = ResourceRegistry.getInstance();
    this.validator = new ValidationEngine();
  }

  /**
   * Main compilation entry point
   * Executes all 6 stages of the pipeline
   */
  async compile(naturalLanguage: string): Promise<CompilationResult> {
    try {
      // Ensure registry is initialized
      if (!this.registry.isInitialized()) {
        await this.registry.initialize();
      }

      this.nodeCounter = 0;
      const stages: string[] = [];

      // Stage 1: Intent Extraction
      stages.push('intent-extraction');
      const intent = this.extractIntent(naturalLanguage);

      // Stage 2: AST Generation
      stages.push('ast-generation');
      const ast = this.generateAST(intent);

      // Stage 3: Semantic Analysis
      stages.push('semantic-analysis');
      const enrichedAST = this.analyzeSemantics(ast);

      // Stage 4: Graph Compilation
      stages.push('graph-compilation');
      let graph = this.compileGraph(enrichedAST);

      // Stage 5: Validation
      stages.push('validation');
      const validation = await this.validator.validate(graph);

      // Repair Loop if needed
      if (!validation.valid) {
        const repairResult = await this.repairGraph(graph, validation);
        if (repairResult.success && repairResult.graph) {
          graph = repairResult.graph;
        } else {
          return {
            success: false,
            errors: validation.errors.map(e => e.message),
            warnings: validation.warnings.map(w => w.message)
          };
        }
      }

      // Stage 6: Optimization (optional)
      stages.push('optimization');
      graph = this.optimizeGraph(graph);

      // Generate metadata
      const metadata: CompilationMetadata = {
        compiledAt: new Date().toISOString(),
        compiler: 'etl-compiler-v1',
        validated: true,
        pipelineStages: stages,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        topology: 'DAG'
      };

      return {
        success: true,
        graph,
        metadata
      };

    } catch (error: any) {
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Stage 1: Intent Extraction
   * Parse natural language into structured intent
   */
  private extractIntent(naturalLanguage: string): Intent {
    const desc = naturalLanguage.toLowerCase();

    // Extract source
    const sourceType = desc.includes('json') ? 'json'
                     : desc.includes('api') ? 'api'
                     : 'csv';

    const sourceFile = desc.match(/load\s+(\S+)/)?.[1] || 
                      desc.match(/read\s+(\S+)/)?.[1] ||
                      '/path/to/data.csv';

    // Extract transformations
    const transformations: TransformationIntent[] = [];
    
    if (desc.includes('filter') || desc.includes('where')) {
      const condition = this.extractFilterCondition(desc);
      transformations.push({
        operation: 'filter',
        config: { condition }
      });
    }

    if (desc.includes('aggregate') || desc.includes('group')) {
      transformations.push({
        operation: 'aggregate',
        config: {
          groupBy: this.extractGroupBy(desc),
          aggregations: this.extractAggregations(desc)
        }
      });
    }

    if (desc.includes('map') || desc.includes('convert')) {
      transformations.push({
        operation: 'map',
        config: {
          targetColumn: this.extractMapTarget(desc),
          expression: this.extractMapExpression(desc)
        }
      });
    }

    if (desc.includes('join')) {
      transformations.push({
        operation: 'join',
        config: {
          joinType: 'inner',
          leftKey: '',
          rightKey: ''
        }
      });
    }

    // Extract target
    const targetType = desc.includes('postgres') || desc.includes('supabase') ? 'postgres'
                     : desc.includes('oracle') ? 'oracle'
                     : desc.includes('mysql') ? 'mysql'
                     : 'sqlite';

    const targetTable = desc.match(/(?:save|write|insert)\s+(?:to|into)\s+(?:\w+\s+)?(\w+)/)?.[1] ||
                       desc.match(/table\s+(\w+)/)?.[1] ||
                       'etl_output';

    // Extract system nodes
    const systemNodes: SystemNodeIntent[] = [];
    
    if (desc.includes('current time') || desc.includes('datetime') || desc.includes('timestamp')) {
      systemNodes.push({
        type: 'current-datetime',
        config: { format: 'ISO8601' }
      });
    }

    if (desc.includes('sequential') || desc.includes('sequence id')) {
      systemNodes.push({
        type: 'sequential-id',
        config: { start: 1, step: 1 }
      });
    }

    return {
      sourceType,
      sourceConfig: {
        filePath: sourceFile,
        delimiter: ',',
        skipRows: 0
      },
      transformations,
      targetType,
      targetConfig: {
        table: targetTable,
        mode: 'append'
      },
      systemNodes
    };
  }

  /**
   * Stage 2: AST Generation
   * Build abstract syntax tree from intent
   */
  private generateAST(intent: Intent): ASTNode[] {
    const ast: ASTNode[] = [];

    // Add source node
    ast.push({
      id: this.generateNodeId(),
      type: 'source',
      subType: intent.sourceType,
      config: intent.sourceConfig,
      connections: []
    });

    // Add system nodes
    for (const sysNode of intent.systemNodes) {
      ast.push({
        id: this.generateNodeId(),
        type: 'system',
        subType: sysNode.type,
        config: sysNode.config,
        connections: []
      });
    }

    // Add transformer nodes
    for (const transform of intent.transformations) {
      ast.push({
        id: this.generateNodeId(),
        type: 'transformer',
        subType: transform.operation,
        config: transform.config,
        connections: []
      });
    }

    // Add target node
    ast.push({
      id: this.generateNodeId(),
      type: 'target',
      subType: intent.targetType,
      config: intent.targetConfig,
      connections: []
    });

    return ast;
  }

  /**
   * Stage 3: Semantic Analysis
   * Enrich AST with semantic information from node catalog
   */
  private analyzeSemantics(ast: ASTNode[]): ASTNode[] {
    return ast.map(node => {
      const nodeDef = this.registry.getNodeDefinition(node.type, node.subType);
      
      if (!nodeDef) {
        throw new Error(`Unknown node type: ${node.type}/${node.subType}`);
      }

      // Enrich with node definition metadata
      return {
        ...node,
        fields: this.inferFields(node, nodeDef),
        config: this.enrichConfig(node.config, nodeDef.config)
      };
    });
  }

  /**
   * Stage 4: Graph Compilation
   * Convert AST to React Flow graph structure
   */
  private compileGraph(ast: ASTNode[]): WorkflowJSON {
    const nodes = ast.map((astNode, index) => this.astNodeToWorkflowNode(astNode, index));
    const edges = this.generateEdges(ast, nodes);

    return {
      version: 1,
      format: 'full',
      nodes,
      edges
    };
  }

  /**
   * Stage 6: Optimization
   * Optimize graph structure (remove redundant nodes, merge operations, etc.)
   */
  private optimizeGraph(graph: WorkflowJSON): WorkflowJSON {
    // For now, return as-is
    // Future optimizations:
    // - Merge consecutive map operations
    // - Remove unused fields
    // - Optimize filter order
    return graph;
  }

  /**
   * Repair graph based on validation errors
   */
  private async repairGraph(graph: WorkflowJSON, validation: any): Promise<CompilationResult> {
    // Basic repair: try to fix common issues
    // For now, return failure - full repair loop to be implemented
    return {
      success: false,
      errors: validation.errors.map((e: any) => e.message)
    };
  }

  // ── Helper Methods ──────────────────────────────────────────────────────────

  private generateNodeId(): string {
    return `node_${++this.nodeCounter}`;
  }

  private inferFields(node: ASTNode, nodeDef: any): any[] {
    if (node.type === 'source' || node.type === 'system') {
      return nodeDef.outputFields || [];
    }
    if (node.type === 'target') {
      return nodeDef.inputFields || [];
    }
    return [];
  }

  private enrichConfig(config: any, schema: any): any {
    const enriched = { ...config };
    
    // Fill in defaults from schema
    for (const [key, prop] of Object.entries(schema || {})) {
      if (enriched[key] === undefined && (prop as any).default !== undefined) {
        enriched[key] = (prop as any).default;
      }
    }
    
    return enriched;
  }

  private astNodeToWorkflowNode(astNode: ASTNode, index: number): any {
    const nodeDef = this.registry.getNodeDefinition(astNode.type, astNode.subType);
    
    const subTypeKey = astNode.type === 'source' ? 'sourceType'
                     : astNode.type === 'transformer' ? 'operation'
                     : astNode.type === 'target' ? 'targetType'
                     : 'systemType';

    return {
      id: astNode.id,
      type: astNode.type,
      position: { x: 100 + index * 250, y: 100 },
      data: {
        label: nodeDef?.label || astNode.subType,
        [subTypeKey]: astNode.subType,
        config: astNode.config,
        outputFields: astNode.type === 'source' || astNode.type === 'system' ? astNode.fields : [],
        inputFields: astNode.type === 'target' ? astNode.fields : [],
        mappings: []
      }
    };
  }

  private generateEdges(ast: ASTNode[], nodes: any[]): any[] {
    const edges: any[] = [];
    
    // Simple linear connection for now
    for (let i = 0; i < nodes.length - 1; i++) {
      const sourceNode = nodes[i];
      const targetNode = nodes[i + 1];
      
      // Skip system nodes for now
      if (sourceNode.type === 'system') continue;
      
      edges.push({
        id: `edge_${sourceNode.id}_${targetNode.id}`,
        type: 'smoothstep',
        source: sourceNode.id,
        sourceHandle: 'node-source',
        target: targetNode.id,
        targetHandle: 'node-target',
        data: { mode: 'node' }
      });
    }
    
    return edges;
  }

  // ── Intent Extraction Helpers ───────────────────────────────────────────────

  private extractFilterCondition(desc: string): string {
    if (desc.includes('timestamp') && desc.includes('current')) {
      return '{{Timestamp}}<{{current_timestamp}}';
    }
    if (desc.includes('where')) {
      const match = desc.match(/where\s+(.+?)(?:\s+(?:save|write|insert|,|$))/);
      return match?.[1] || '';
    }
    return '';
  }

  private extractGroupBy(desc: string): string {
    const match = desc.match(/group\s+by\s+(\w+)/i);
    return match ? `{{${match[1]}}}` : '';
  }

  private extractAggregations(desc: string): string {
    if (desc.includes('count')) {
      const match = desc.match(/count\s+(\w+)/i);
      return match ? `Count({{${match[1]}}})` : 'Count(*)';
    }
    return '';
  }

  private extractMapTarget(desc: string): string {
    const match = desc.match(/convert\s+(\w+)/i);
    return match?.[1] || '';
  }

  private extractMapExpression(desc: string): string {
    if (desc.includes('real') || desc.includes('float')) {
      const match = desc.match(/convert\s+(\w+)\s+to\s+real/i);
      return match ? `REAL({{${match[1]}}})` : '';
    }
    return '';
  }
}

// Made with Bob