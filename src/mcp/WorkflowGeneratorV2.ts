/**
 * WorkflowGenerator V2 - JSON-Driven Architecture
 * 
 * This version uses semantic resources from JSON files instead of hardcoded logic.
 * All node types, configurations, and behaviors are derived from:
 * - node-catalog.json
 * - field-propagation-rules.json
 * - etl-graph-generator-specification.json
 * 
 * Maintains backward compatibility with V1 while adding semantic awareness.
 */

import { ResourceRegistry } from '../semantic/ResourceRegistry';
import { WorkflowJSON, WorkflowNode, WorkflowEdge, WorkflowField } from './WorkflowGenerator';

const DEFAULT_SOURCE_COLUMNS = ['id', 'name', 'value', 'created_at'];

export class WorkflowGeneratorV2 {
  private registry: ResourceRegistry;
  private nodeCounter = 0;

  constructor() {
    this.registry = ResourceRegistry.getInstance();
  }

  /**
   * Generate workflow from natural language description
   * Uses semantic resources to build the graph dynamically
   */
  async generateWorkflow(description: string): Promise<WorkflowJSON> {
    // Ensure registry is initialized
    if (!this.registry.isInitialized()) {
      await this.registry.initialize();
    }

    this.nodeCounter = 0;
    const intent = this.parseIntent(description);
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // Build nodes using node catalog
    const sourceNode = this.createSourceNode(intent);
    nodes.push(sourceNode);

    // Add system nodes if needed
    if (intent.hasTimestamp) {
      const datetimeNode = this.createSystemNode('current-datetime');
      nodes.push(datetimeNode);

      const filterNode = this.createTransformerNode('filter', {
        condition: `{{${intent.filterField}}}<{{current_timestamp}}`
      });
      nodes.push(filterNode);

      // Connect datetime -> filter
      edges.push(this.createEdge(datetimeNode.id, 'out_datetime', filterNode.id, 'out_datetime'));
      edges.push(this.createEdge(sourceNode.id, 'col_0', filterNode.id, 'col_0'));
    }

    if (intent.hasSequentialId) {
      const seqNode = this.createSystemNode('sequential-id');
      nodes.push(seqNode);
    }

    // Add transformers
    if (intent.hasAggregate) {
      const aggNode = this.createTransformerNode('aggregate', {
        groupBy: `{{${intent.aggregateField}}}`,
        aggregations: `Count({{${intent.aggregateField}}})`
      });
      nodes.push(aggNode);
      const aggregateField = intent.sourceFields.find(f => f.name === intent.aggregateField) || intent.sourceFields[0];
      edges.push(this.createEdge(sourceNode.id, aggregateField.id, aggNode.id, aggregateField.id));
    }

    if (intent.hasMap) {
      const mapNode = this.createTransformerNode('map', {
        targetColumn: '',
        expression: intent.mapExpression
      });
      nodes.push(mapNode);
      const mapField = intent.sourceFields.find(f => f.name === intent.mapField) || intent.sourceFields[0];
      edges.push(this.createEdge(sourceNode.id, mapField.id, mapNode.id, mapField.id));
    }

    // Add target node
    const targetNode = this.createTargetNode(intent);
    nodes.push(targetNode);

    // Connect to target
    if (intent.hasSequentialId) {
      const seqNode = nodes.find(n => n.data.systemType === 'sequential-id');
      if (seqNode) {
        edges.push(this.createEdge(seqNode.id, 'out_seq', targetNode.id, 'sql_col_0'));
      }
    }

    if (intent.hasMap) {
      const mapNode = nodes.find(n => n.data.operation === 'map');
      if (mapNode) {
        const mapField = intent.sourceFields.find(f => f.name === intent.mapField) || intent.sourceFields[0];
        const mapTarget = intent.targetFields.find(f => f.name === this.toSnakeCase(mapField.name)) || intent.targetFields[0];
        edges.push(this.createEdge(mapNode.id, mapField.id, targetNode.id, mapTarget.id));
      }
    }

    // Direct connections
    const filterNode = nodes.find(n => n.data.operation === 'filter');
    intent.sourceFields.forEach((sourceField, index) => {
      const targetField = intent.targetFields[index];
      if (!targetField) {return;}
      const sourceId = intent.hasTimestamp && index === 0 && filterNode ? filterNode.id : sourceNode.id;
      edges.push(this.createEdge(sourceId, sourceField.id, targetNode.id, targetField.id));
    });

    return {
      version: 1,
      format: 'full',
      nodes,
      edges
    };
  }

  /**
   * Create source node using node catalog
   */
  private createSourceNode(intent: ParsedIntent): WorkflowNode {
    const nodeDef = this.registry.getNodeDefinition('source', intent.sourceType);
    if (!nodeDef) {
      throw new Error(`Unknown source type: ${intent.sourceType}`);
    }

    return {
      id: this.generateNodeId(),
      type: 'source',
      data: {
        label: nodeDef.label,
        sourceType: intent.sourceType,
        config: {
          filePath: intent.sourceFile,
          delimiter: ',',
          skipRows: 0
        },
        outputFields: intent.sourceFields
      }
    };
  }

  /**
   * Create transformer node using node catalog
   */
  private createTransformerNode(operation: string, config: Record<string, any>): WorkflowNode {
    const nodeDef = this.registry.getNodeDefinition('transformer', operation);
    if (!nodeDef) {
      throw new Error(`Unknown transformer operation: ${operation}`);
    }

    const propRule = this.registry.getPropagationRule(operation);

    return {
      id: this.generateNodeId(),
      type: 'transformer',
      data: {
        label: nodeDef.label,
        operation,
        config,
        inputFields: [],
        outputFields: propRule?.defaultFields || [],
        mappings: []
      }
    };
  }

  /**
   * Create target node using node catalog
   */
  private createTargetNode(intent: ParsedIntent): WorkflowNode {
    const nodeDef = this.registry.getNodeDefinition('target', intent.targetType);
    if (!nodeDef) {
      throw new Error(`Unknown target type: ${intent.targetType}`);
    }

    const connectionStr = intent.targetType === 'sqlite'
      ? '/path/to/sqlite.db'
      : `${intent.targetType}://user:pass@host:5432/${intent.targetTable}`;

    return {
      id: this.generateNodeId(),
      type: 'target',
      data: {
        label: nodeDef.label,
        targetType: intent.targetType,
        config: {
          connectionString: connectionStr,
          table: intent.targetTable,
          mode: 'append'
        },
        inputFields: intent.targetFields
      }
    };
  }

  /**
   * Create system node using node catalog
   */
  private createSystemNode(systemType: string): WorkflowNode {
    const nodeDef = this.registry.getNodeDefinition('system', systemType);
    if (!nodeDef) {
      throw new Error(`Unknown system type: ${systemType}`);
    }

    // Build config from node definition defaults
    const config: Record<string, any> = {};
    for (const [key, prop] of Object.entries(nodeDef.config)) {
      config[key] = (prop as any).default;
    }

    return {
      id: this.generateNodeId(),
      type: 'system',
      data: {
        label: nodeDef.label,
        systemType,
        config,
        outputFields: (nodeDef as any).outputFields || []
      }
    };
  }

  /**
   * Create edge using handle conventions from graph spec
   */
  private createEdge(
    sourceId: string,
    sourceFieldId: string,
    targetId: string,
    targetFieldId: string
  ): WorkflowEdge {
    const handleConventions = this.registry.getHandleConventions();
    
    return {
      id: `edge_${sourceId}_${sourceFieldId}_${targetId}_${targetFieldId}`,
      type: 'smoothstep',
      source: sourceId,
      sourceHandle: `output-${sourceFieldId}`,
      target: targetId,
      targetHandle: `input-${targetFieldId}`,
      data: { mode: 'field' }
    };
  }

  /**
   * Generate sequential node ID following ID conventions
   */
  private generateNodeId(): string {
    const conventions = this.registry.getIDConventions();
    return `node_${++this.nodeCounter}`;
  }

  /**
   * Parse natural language description into structured intent
   */
  private parseIntent(desc: string): ParsedIntent {
    const d = desc.toLowerCase();
    const sourceFields = this.buildSourceFields(this.extractColumnNames(desc));
    const targetFields = this.buildTargetFields(sourceFields);
    const sourceFile = this.extractSourceFile(desc);

    return {
      sourceFile,
      sourceType: d.includes('api') || /^https?:\/\//i.test(sourceFile) ? 'api'
                : d.includes('json') ? 'json'
                : 'csv',
      targetTable: this.extractTargetTable(desc),
      targetType: d.includes('postgres') || d.includes('supabase') ? 'postgres'
                : d.includes('oracle') ? 'oracle'
                : 'sqlite',
      hasFilter: d.includes('filter') || d.includes('timestamp') || d.includes('before'),
      filterField: sourceFields[0]?.name || 'created_at',
      hasAggregate: d.includes('aggregate') || d.includes('group') || d.includes('count'),
      aggregateField: sourceFields[1]?.name || sourceFields[0]?.name || 'id',
      hasMap: d.includes('map') || d.includes('convert') || d.includes('real'),
      mapField: sourceFields[2]?.name || sourceFields[0]?.name || 'value',
      mapExpression: `REAL({{${sourceFields[2]?.name || sourceFields[0]?.name || 'value'}}})`,
      hasSequentialId: d.includes('sequential') || d.includes('id') || d.includes('sequence'),
      hasTimestamp: d.includes('timestamp') || d.includes('filter') || d.includes('datetime'),
      sourceFields,
      targetFields
    };
  }

  private extractColumnNames(desc: string): string[] {
    const columnsMatch = desc.match(/(?:columns|fields)\s+([a-zA-Z0-9_,\s]+)/i);
    if (!columnsMatch) {
      return DEFAULT_SOURCE_COLUMNS;
    }

    const columns = columnsMatch[1]
      .split(/[,\s]+/)
      .map(c => c.trim())
      .filter(Boolean)
      .filter(c => !['to', 'into', 'from', 'save', 'write', 'insert', 'table'].includes(c.toLowerCase()));

    return columns.length > 0 ? columns : DEFAULT_SOURCE_COLUMNS;
  }

  private extractSourceFile(desc: string): string {
    return desc.match(/https?:\/\/[^\s,;]+/i)?.[0] ||
      desc.match(/(?:load|read|from)\s+([^\s,]+)/i)?.[1] ||
      '/path/to/data.csv';
  }

  private extractTargetTable(desc: string): string {
    const destinationMatch = desc.match(/(?:save|write|insert)\s+(?:to|into)\s+(?:(?:sqlite|postgres|postgresql|supabase|oracle|mysql)\s+)?(\w+)/i);
    const destination = destinationMatch?.[1];

    if (destination && !this.isTargetTypeWord(destination)) {
      return destination;
    }

    return desc.match(/table\s+(\w+)/i)?.[1] ||
      this.deriveTableNameFromSource(this.extractSourceFile(desc)) ||
      'etl_output';
  }

  private deriveTableNameFromSource(source: string): string | undefined {
    if (!/^https?:\/\//i.test(source)) {
      return undefined;
    }

    return new URL(source).pathname.split('/').filter(Boolean).pop()?.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private isTargetTypeWord(value: string): boolean {
    return ['sqlite', 'postgres', 'postgresql', 'supabase', 'oracle', 'mysql'].includes(value.toLowerCase());
  }

  private buildSourceFields(columnNames: string[]): WorkflowField[] {
    return columnNames.map((name, index) => ({
      id: `col_${index}`,
      name,
      type: this.inferFieldType(name)
    }));
  }

  private buildTargetFields(sourceFields: WorkflowField[]): WorkflowField[] {
    return sourceFields.map((field, index) => ({
      id: `sql_col_${index}`,
      name: this.toSnakeCase(field.name),
      type: this.toSqlFieldType(field.type)
    }));
  }

  private inferFieldType(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.includes('date') || normalized.includes('time') || normalized.endsWith('_at')) {return 'datetime';}
    if (normalized.startsWith('is_') || normalized.startsWith('has_')) {return 'boolean';}
    if (normalized.includes('id') || normalized.includes('count') || normalized.includes('qty')) {return 'integer';}
    if (normalized.includes('amount') || normalized.includes('price') || normalized.includes('total') || normalized.includes('value')) {return 'float';}
    return 'string';
  }

  private toSqlFieldType(type: string): string {
    if (type === 'float') {return 'real';}
    if (type === 'string') {return 'text';}
    return type;
  }

  private toSnakeCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }
}

interface ParsedIntent {
  sourceFile: string;
  sourceType: 'csv' | 'json' | 'api';
  targetTable: string;
  targetType: 'sqlite' | 'postgres' | 'oracle';
  hasFilter: boolean;
  filterField: string;
  hasAggregate: boolean;
  aggregateField: string;
  hasMap: boolean;
  mapField: string;
  mapExpression: string;
  hasSequentialId: boolean;
  hasTimestamp: boolean;
  sourceFields: WorkflowField[];
  targetFields: WorkflowField[];
}

// Made with Bob
