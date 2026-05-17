/**
 * ID Generator
 * Generates IDs following conventions from etl-graph-generator-specification.json
 * 
 * ID Patterns:
 * - Node IDs: node_1, node_2, ...
 * - Edge IDs: edge_{source}_{sourceHandle}_{target}_{targetHandle}
 * - Field IDs: col_0, sql_col_0, agg_1, out_seq, out_datetime
 * - Handle IDs: output-{fieldId}, input-{fieldId}, node-source, node-target
 */

import { ResourceRegistry } from '../../semantic/ResourceRegistry';

export class IDGenerator {
  private registry: ResourceRegistry;
  private counters: Map<string, number>;

  constructor() {
    this.registry = ResourceRegistry.getInstance();
    this.counters = new Map();
  }

  /**
   * Generate node ID following convention: node_1, node_2, ...
   */
  generateNodeId(): string {
    const conventions = this.registry.getIDConventions();
    const pattern = conventions.nodeId.pattern; // "node_{n}"
    const counter = this.getCounter('node');
    return pattern.replace('{n}', counter.toString());
  }

  /**
   * Generate edge ID following convention
   */
  generateEdgeId(source: string, sourceHandle: string, target: string, targetHandle: string): string {
    const conventions = this.registry.getIDConventions();
    const pattern = conventions.edgeId.pattern; // "edge_{source}_{sourceHandle}_{target}_{targetHandle}"
    
    return pattern
      .replace('{source}', source)
      .replace('{sourceHandle}', sourceHandle)
      .replace('{target}', target)
      .replace('{targetHandle}', targetHandle);
  }

  /**
   * Generate field ID based on type
   */
  generateFieldId(type: 'column' | 'sql' | 'aggregate' | 'system'): string {
    const conventions = this.registry.getIDConventions();
    
    switch (type) {
      case 'column':
        const colCounter = this.getCounter('col');
        return `col_${colCounter}`;
      
      case 'sql':
        const sqlCounter = this.getCounter('sql_col');
        return `sql_col_${sqlCounter}`;
      
      case 'aggregate':
        const aggCounter = this.getCounter('agg');
        return `agg_${aggCounter}`;
      
      case 'system':
        // System fields have specific names, not sequential
        return 'out_system';
      
      default:
        return `field_${this.getCounter('field')}`;
    }
  }

  /**
   * Generate handle ID following convention
   */
  generateHandleId(direction: 'input' | 'output', fieldId: string): string {
    const conventions = this.registry.getHandleConventions();
    
    if (direction === 'output') {
      return conventions.outputHandle.pattern.replace('{fieldId}', fieldId);
    } else {
      return conventions.inputHandle.pattern.replace('{fieldId}', fieldId);
    }
  }

  /**
   * Generate node-level handle (for node-to-node connections)
   */
  generateNodeHandle(direction: 'source' | 'target'): string {
    const conventions = this.registry.getHandleConventions();
    return direction === 'source' 
      ? conventions.nodeSourceHandle.id 
      : conventions.nodeTargetHandle.id;
  }

  /**
   * Parse node ID to extract number
   */
  parseNodeId(nodeId: string): number | null {
    const match = nodeId.match(/node_(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Parse edge ID to extract components
   */
  parseEdgeId(edgeId: string): EdgeIdComponents | null {
    const match = edgeId.match(/edge_(.+?)_(.+?)_(.+?)_(.+)/);
    if (!match) return null;
    
    return {
      source: match[1],
      sourceHandle: match[2],
      target: match[3],
      targetHandle: match[4]
    };
  }

  /**
   * Validate ID format
   */
  validateNodeId(nodeId: string): boolean {
    return /^node_\d+$/.test(nodeId);
  }

  validateEdgeId(edgeId: string): boolean {
    return /^edge_.+_.+_.+_.+$/.test(edgeId);
  }

  validateFieldId(fieldId: string): boolean {
    return /^(col_\d+|sql_col_\d+|agg_\d+|out_\w+)$/.test(fieldId);
  }

  validateHandleId(handleId: string): boolean {
    return /^(input|output)-.+$/.test(handleId) || 
           handleId === 'node-source' || 
           handleId === 'node-target';
  }

  /**
   * Reset all counters (for testing)
   */
  reset(): void {
    this.counters.clear();
  }

  /**
   * Reset specific counter
   */
  resetCounter(type: string): void {
    this.counters.delete(type);
  }

  /**
   * Get and increment counter
   */
  private getCounter(type: string): number {
    const current = this.counters.get(type) || 0;
    const next = current + 1;
    this.counters.set(type, next);
    return next;
  }
}

export interface EdgeIdComponents {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

// Made with Bob