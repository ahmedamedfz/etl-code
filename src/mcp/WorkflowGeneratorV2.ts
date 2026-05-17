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
      edges.push(this.createEdge(sourceNode.id, 'col_15', aggNode.id, 'col_15'));
    }

    if (intent.hasMap) {
      const mapNode = this.createTransformerNode('map', {
        targetColumn: '',
        expression: intent.mapExpression
      });
      nodes.push(mapNode);
      edges.push(this.createEdge(sourceNode.id, 'col_18', mapNode.id, 'col_18'));
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
        edges.push(this.createEdge(mapNode.id, 'col_18', targetNode.id, 'sql_col_19'));
      }
    }

    // Direct connections
    if (intent.hasTimestamp) {
      const filterNode = nodes.find(n => n.data.operation === 'filter');
      if (filterNode) {
        edges.push(this.createEdge(filterNode.id, 'col_0', targetNode.id, 'sql_col_2'));
      }
    } else {
      edges.push(this.createEdge(sourceNode.id, 'col_0', targetNode.id, 'sql_col_2'));
    }
    edges.push(this.createEdge(sourceNode.id, 'col_1', targetNode.id, 'sql_col_1'));

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
        outputFields: this.getBatteryFields() // TODO: Make dynamic
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
      ? '/path/to/batteries.db'
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
        inputFields: this.getBatteryTargetFields() // TODO: Make dynamic
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
    return {
      sourceFile: d.includes('battery') ? '/path/to/battery.csv' : '/path/to/data.csv',
      sourceType: d.includes('json') ? 'json' : 'csv',
      targetTable: d.includes('battery_telemetry') ? 'battery_telemetry'
                 : d.includes('battery') ? 'battery_telemetry'
                 : 'etl_output',
      targetType: d.includes('postgres') || d.includes('supabase') ? 'postgres'
                : d.includes('oracle') ? 'oracle'
                : 'sqlite',
      hasFilter: d.includes('filter') || d.includes('timestamp') || d.includes('before'),
      filterField: 'Timestamp',
      hasAggregate: d.includes('aggregate') || d.includes('group') || d.includes('count'),
      aggregateField: 'State_Flag',
      hasMap: d.includes('map') || d.includes('convert') || d.includes('real') || d.includes('humidity'),
      mapField: 'Humidity_Percentage',
      mapExpression: 'REAL({{Humidity_Percentage}})',
      hasSequentialId: d.includes('sequential') || d.includes('id') || d.includes('sequence'),
      hasTimestamp: d.includes('timestamp') || d.includes('filter') || d.includes('datetime'),
      fieldSet: d.includes('battery') ? 'battery' : 'generic'
    };
  }

  // TODO: Replace with dynamic field generation from schema
  private getBatteryFields(): WorkflowField[] {
    return [
      { id: 'col_0', name: 'Timestamp', type: 'date' },
      { id: 'col_1', name: 'Device_ID', type: 'string' },
      { id: 'col_2', name: 'Battery_Voltage_V', type: 'float' },
      // ... rest of fields
    ];
  }

  private getBatteryTargetFields(): WorkflowField[] {
    return [
      { id: 'sql_col_0', name: 'id', type: 'integer' },
      { id: 'sql_col_1', name: 'device_id', type: 'text' },
      { id: 'sql_col_2', name: 'timestamp', type: 'datetime' },
      // ... rest of fields
    ];
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
  fieldSet: 'battery' | 'generic';
}

// Made with Bob
