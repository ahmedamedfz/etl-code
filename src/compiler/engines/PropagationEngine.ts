/**
 * Field Propagation Engine
 * Dynamically propagates fields through the ETL graph using propagation-rules.json
 * 
 * Implements field transformation logic based on operation types:
 * - passthrough: Fields pass unchanged
 * - subset: Select specific fields
 * - reduce: Reduce to specific fields (e.g., aggregation)
 * - merge: Merge fields from multiple inputs
 * - extend: Add new fields to existing ones
 */

import { ResourceRegistry } from '../../semantic/ResourceRegistry';
import { WorkflowJSON, WorkflowNode, WorkflowField } from '../../mcp/WorkflowGenerator';

export interface PropagationResult {
  success: boolean;
  graph: WorkflowJSON;
  errors?: string[];
}

export class PropagationEngine {
  private registry: ResourceRegistry;

  constructor() {
    this.registry = ResourceRegistry.getInstance();
  }

  /**
   * Propagate fields through the entire graph
   * Uses topological sort to process nodes in dependency order
   */
  async propagate(graph: WorkflowJSON): Promise<PropagationResult> {
    try {
      if (!this.registry.isInitialized()) {
        await this.registry.initialize();
      }

      const sortedNodes = this.topologicalSort(graph);
      const updatedNodes = [...graph.nodes];

      for (const node of sortedNodes) {
        if (node.type === 'transformer') {
          const propRule = this.registry.getPropagationRule(node.data.operation);
          
          if (!propRule) {
            console.warn(`No propagation rule for operation: ${node.data.operation}`);
            continue;
          }

          const incomingFields = this.getIncomingFields(node, graph);
          const outputFields = this.applyPropagationRule(propRule, incomingFields, node);

          // Update node in the graph
          const nodeIndex = updatedNodes.findIndex(n => n.id === node.id);
          if (nodeIndex >= 0) {
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              data: {
                ...updatedNodes[nodeIndex].data,
                inputFields: incomingFields,
                outputFields
              }
            };
          }
        }
      }

      return {
        success: true,
        graph: {
          ...graph,
          nodes: updatedNodes
        }
      };

    } catch (error: any) {
      return {
        success: false,
        graph,
        errors: [error.message]
      };
    }
  }

  /**
   * Apply propagation rule based on transformation type
   */
  private applyPropagationRule(
    rule: any,
    incomingFields: WorkflowField[],
    node: WorkflowNode
  ): WorkflowField[] {
    switch (rule.transformation) {
      case 'passthrough':
        return this.applyPassthrough(incomingFields);

      case 'subset':
        return this.applySubset(incomingFields, node.data.config);

      case 'reduce':
        return this.applyReduce(rule, node.data.config);

      case 'merge':
        return this.applyMerge(incomingFields);

      case 'extend':
        return this.applyExtend(incomingFields, node.data.config, rule);

      default:
        console.warn(`Unknown transformation type: ${rule.transformation}`);
        return incomingFields;
    }
  }

  /**
   * Passthrough: All fields pass unchanged
   */
  private applyPassthrough(fields: WorkflowField[]): WorkflowField[] {
    return [...fields];
  }

  /**
   * Subset: Select specific fields based on config
   */
  private applySubset(fields: WorkflowField[], config: any): WorkflowField[] {
    if (config.columns && Array.isArray(config.columns)) {
      return fields.filter(f => config.columns.includes(f.name));
    }
    
    if (config.targetColumn) {
      return fields.filter(f => f.name === config.targetColumn);
    }

    // Default: return all fields
    return fields;
  }

  /**
   * Reduce: Reduce to specific output fields (e.g., aggregation result)
   */
  private applyReduce(rule: any, config: any): WorkflowField[] {
    const defaultFields = rule.defaultFields || [];
    
    // For aggregate operations, generate fields based on config
    if (config.groupBy && config.aggregations) {
      const fields: WorkflowField[] = [];
      
      // Add group by field
      const groupByField = this.extractFieldName(config.groupBy);
      if (groupByField) {
        fields.push({
          id: `agg_0`,
          name: groupByField,
          type: 'string'
        });
      }

      // Add aggregation result field
      fields.push({
        id: `agg_1`,
        name: 'count',
        type: 'integer'
      });

      return fields;
    }

    return defaultFields;
  }

  /**
   * Merge: Merge fields from multiple inputs
   */
  private applyMerge(fields: WorkflowField[]): WorkflowField[] {
    // Remove duplicates by name
    const uniqueFields = new Map<string, WorkflowField>();
    
    for (const field of fields) {
      if (!uniqueFields.has(field.name)) {
        uniqueFields.set(field.name, field);
      }
    }

    return Array.from(uniqueFields.values());
  }

  /**
   * Extend: Add new fields to existing ones
   */
  private applyExtend(
    incomingFields: WorkflowField[],
    config: any,
    rule: any
  ): WorkflowField[] {
    const extended = [...incomingFields];

    // For map operations, add the new mapped field
    if (config.targetColumn && config.expression) {
      const newField: WorkflowField = {
        id: `map_${extended.length}`,
        name: config.targetColumn,
        type: this.inferTypeFromExpression(config.expression)
      };
      extended.push(newField);
    }

    // Add any default fields from the rule
    if (rule.defaultFields) {
      for (const defaultField of rule.defaultFields) {
        if (!extended.find(f => f.name === defaultField.name)) {
          extended.push(defaultField);
        }
      }
    }

    return extended;
  }

  /**
   * Get incoming fields for a node from its predecessors
   */
  private getIncomingFields(node: WorkflowNode, graph: WorkflowJSON): WorkflowField[] {
    const incomingEdges = graph.edges.filter(e => e.target === node.id);
    const fields: WorkflowField[] = [];

    for (const edge of incomingEdges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      if (sourceNode) {
        const sourceFields = sourceNode.data.outputFields || [];
        fields.push(...sourceFields);
      }
    }

    return this.applyMerge(fields); // Remove duplicates
  }

  /**
   * Topological sort of nodes for dependency-order processing
   */
  private topologicalSort(graph: WorkflowJSON): WorkflowNode[] {
    const visited = new Set<string>();
    const sorted: WorkflowNode[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) {return;}
      visited.add(nodeId);

      // Visit all predecessors first
      const incomingEdges = graph.edges.filter(e => e.target === nodeId);
      for (const edge of incomingEdges) {
        visit(edge.source);
      }

      const node = graph.nodes.find(n => n.id === nodeId);
      if (node) {
        sorted.push(node);
      }
    };

    // Start with nodes that have no incoming edges (sources, system nodes)
    const startNodes = graph.nodes.filter(node => {
      const hasIncoming = graph.edges.some(e => e.target === node.id);
      return !hasIncoming;
    });

    for (const node of startNodes) {
      visit(node.id);
    }

    // Visit any remaining nodes (in case of disconnected components)
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return sorted;
  }

  /**
   * Extract field name from expression like {{fieldName}}
   */
  private extractFieldName(expression: string): string | null {
    const match = expression.match(/\{\{(\w+)\}\}/);
    return match ? match[1] : null;
  }

  /**
   * Infer data type from expression
   */
  private inferTypeFromExpression(expression: string): string {
    const expr = expression.toLowerCase();
    
    if (expr.includes('real(') || expr.includes('float(')) {
      return 'float';
    }
    if (expr.includes('int(') || expr.includes('integer(')) {
      return 'integer';
    }
    if (expr.includes('count(') || expr.includes('sum(')) {
      return 'integer';
    }
    if (expr.includes('avg(')) {
      return 'float';
    }
    if (expr.includes('concat(') || expr.includes('lower(') || expr.includes('upper(')) {
      return 'string';
    }
    
    return 'string'; // Default
  }

  /**
   * Validate field references in expressions
   */
  validateFieldReferences(node: WorkflowNode, availableFields: WorkflowField[]): boolean {
    const config = node.data.config;
    const expressions: string[] = [];

    // Collect all expressions from config
    if (config.condition) {expressions.push(config.condition);}
    if (config.expression) {expressions.push(config.expression);}
    if (config.groupBy) {expressions.push(config.groupBy);}
    if (config.aggregations) {expressions.push(config.aggregations);}

    // Check each expression
    for (const expr of expressions) {
      const fieldRefs = this.extractFieldReferences(expr);
      for (const fieldRef of fieldRefs) {
        const exists = availableFields.some(f => f.name === fieldRef);
        if (!exists) {
          console.warn(`Field reference not found: ${fieldRef} in expression: ${expr}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Extract all field references from an expression
   */
  private extractFieldReferences(expression: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(expression)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }
}

// Made with Bob