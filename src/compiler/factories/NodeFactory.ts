/**
 * Node Factory
 * Dynamically creates workflow nodes using node-catalog.json
 * All node types, configurations, and fields are derived from semantic resources
 */

import { ResourceRegistry } from '../../semantic/ResourceRegistry';
import { WorkflowNode, WorkflowField } from '../../mcp/WorkflowGenerator';

export class NodeFactory {
  private registry: ResourceRegistry;
  private nodeCounter = 0;

  constructor() {
    this.registry = ResourceRegistry.getInstance();
  }

  /**
   * Create a node dynamically from node catalog
   */
  async createNode(
    type: 'source' | 'transformer' | 'target' | 'system',
    subType: string,
    config?: any
  ): Promise<WorkflowNode> {
    if (!this.registry.isInitialized()) {
      await this.registry.initialize();
    }

    const nodeDef = this.registry.getNodeDefinition(type, subType);
    if (!nodeDef) {
      throw new Error(`Unknown node: ${type}/${subType}`);
    }

    const nodeId = this.generateNodeId();
    const subTypeKey = this.getSubTypeKey(type);
    const nodeConfig = this.buildConfig(nodeDef.config, config);

    return {
      id: nodeId,
      type,
      data: {
        label: nodeDef.label,
        [subTypeKey]: subType,
        config: nodeConfig,
        outputFields: this.generateOutputFields(type, nodeDef),
        inputFields: this.generateInputFields(type, nodeDef),
        mappings: []
      }
    };
  }

  /**
   * Create source node
   */
  async createSourceNode(sourceType: string, config: any): Promise<WorkflowNode> {
    return this.createNode('source', sourceType, config);
  }

  /**
   * Create transformer node
   */
  async createTransformerNode(operation: string, config: any): Promise<WorkflowNode> {
    return this.createNode('transformer', operation, config);
  }

  /**
   * Create target node
   */
  async createTargetNode(targetType: string, config: any): Promise<WorkflowNode> {
    return this.createNode('target', targetType, config);
  }

  /**
   * Create system node
   */
  async createSystemNode(systemType: string, config?: any): Promise<WorkflowNode> {
    return this.createNode('system', systemType, config);
  }

  /**
   * Build node configuration from schema and user input
   */
  private buildConfig(schema: any, userConfig?: any): any {
    const config: any = {};

    // Start with defaults from schema
    for (const [key, prop] of Object.entries(schema || {})) {
      const propDef = prop as any;
      config[key] = propDef.default;
    }

    // Override with user config
    if (userConfig) {
      Object.assign(config, userConfig);
    }

    return config;
  }

  /**
   * Generate output fields for source and system nodes
   */
  private generateOutputFields(type: string, nodeDef: any): WorkflowField[] {
    if (type === 'source' || type === 'system') {
      return nodeDef.outputFields || [];
    }
    return [];
  }

  /**
   * Generate input fields for target nodes
   */
  private generateInputFields(type: string, nodeDef: any): WorkflowField[] {
    if (type === 'target') {
      return nodeDef.inputFields || [];
    }
    return [];
  }

  /**
   * Get the subtype key name for a node type
   */
  private getSubTypeKey(type: string): string {
    const keyMap: Record<string, string> = {
      source: 'sourceType',
      transformer: 'operation',
      target: 'targetType',
      system: 'systemType'
    };
    return keyMap[type] || 'type';
  }

  /**
   * Generate sequential node ID following ID conventions
   */
  private generateNodeId(): string {
    const conventions = this.registry.getIDConventions();
    return `node_${++this.nodeCounter}`;
  }

  /**
   * Reset node counter (for testing)
   */
  resetCounter(): void {
    this.nodeCounter = 0;
  }

  /**
   * Validate node configuration against schema
   */
  validateConfig(type: string, subType: string, config: any): { valid: boolean; errors: string[] } {
    const nodeDef = this.registry.getNodeDefinition(type as any, subType);
    if (!nodeDef) {
      return { valid: false, errors: [`Unknown node type: ${type}/${subType}`] };
    }

    const errors: string[] = [];
    const schema = nodeDef.config || {};

    // Check required fields
    for (const [key, prop] of Object.entries(schema)) {
      const propDef = prop as any;
      if (propDef.required && (config[key] === undefined || config[key] === null)) {
        errors.push(`Missing required config field: ${key}`);
      }
    }

    // Check field types
    for (const [key, value] of Object.entries(config)) {
      const propDef = schema[key] as any;
      if (propDef && propDef.type) {
        const actualType = typeof value;
        const expectedType = propDef.type;

        if (expectedType === 'integer' && actualType !== 'number') {
          errors.push(`Config field '${key}' should be a number`);
        } else if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`Config field '${key}' should be a string`);
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`Config field '${key}' should be a boolean`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get all available node types for a category
   */
  getAvailableTypes(category: 'source' | 'transformer' | 'target' | 'system'): string[] {
    return this.registry.getNodeTypes(category);
  }

  /**
   * Get node definition for inspection
   */
  getNodeDefinition(type: 'source' | 'transformer' | 'target' | 'system', subType: string): any {
    return this.registry.getNodeDefinition(type, subType);
  }

  /**
   * Create a batch of nodes
   */
  async createNodes(specs: NodeSpec[]): Promise<WorkflowNode[]> {
    const nodes: WorkflowNode[] = [];
    
    for (const spec of specs) {
      const node = await this.createNode(spec.type, spec.subType, spec.config);
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Clone a node with a new ID
   */
  cloneNode(node: WorkflowNode): WorkflowNode {
    return {
      ...node,
      id: this.generateNodeId()
    };
  }

  /**
   * Update node configuration
   */
  updateNodeConfig(node: WorkflowNode, newConfig: any): WorkflowNode {
    return {
      ...node,
      data: {
        ...node.data,
        config: {
          ...node.data.config,
          ...newConfig
        }
      }
    };
  }
}

export interface NodeSpec {
  type: 'source' | 'transformer' | 'target' | 'system';
  subType: string;
  config?: any;
}

// Made with Bob