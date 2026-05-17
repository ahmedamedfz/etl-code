/**
 * Resource Registry (Singleton)
 * Central registry for all semantic resources
 * Provides type-safe access to JSON knowledge files
 */

import { ResourceLoader, SemanticResources } from './ResourceLoader';

export class ResourceRegistry {
  private static instance: ResourceRegistry;
  private resources: SemanticResources | null = null;
  private loader: ResourceLoader;
  private initialized = false;

  private constructor() {
    this.loader = new ResourceLoader();
  }

  static getInstance(): ResourceRegistry {
    if (!ResourceRegistry.instance) {
      ResourceRegistry.instance = new ResourceRegistry();
    }
    return ResourceRegistry.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.resources = await this.loader.loadAll();
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ── Accessors for each JSON resource ────────────────────────────────────────

  getCompilerPipeline() {
    this.ensureInitialized();
    return this.resources!.compilerPipeline;
  }

  getGraphSpec() {
    this.ensureInitialized();
    return this.resources!.graphSpec;
  }

  getNodeCatalog() {
    this.ensureInitialized();
    return this.resources!.nodeCatalog;
  }

  getPropagationRules() {
    this.ensureInitialized();
    return this.resources!.propagationRules;
  }

  getValidationRules() {
    this.ensureInitialized();
    return this.resources!.validationRules;
  }

  getPromptTemplates() {
    this.ensureInitialized();
    return this.resources!.promptTemplates;
  }

  getExamplePatterns() {
    this.ensureInitialized();
    return this.resources!.examplePatterns;
  }

  // ── Helper methods ──────────────────────────────────────────────────────────

  /**
   * Get node definition from catalog by type and subType
   */
  getNodeDefinition(nodeType: 'source' | 'transformer' | 'target' | 'system', subType: string) {
    const catalog = this.getNodeCatalog();
    
    switch (nodeType) {
      case 'source':
        return catalog.sources.find((n: any) => n.type === subType);
      case 'transformer':
        return catalog.transformers.find((n: any) => n.operation === subType);
      case 'target':
        return catalog.targets.find((n: any) => n.type === subType);
      case 'system':
        return catalog.system.find((n: any) => n.type === subType);
      default:
        return null;
    }
  }

  /**
   * Get all node types for a category
   */
  getNodeTypes(category: 'source' | 'transformer' | 'target' | 'system'): string[] {
    const catalog = this.getNodeCatalog();
    
    switch (category) {
      case 'source':
        return catalog.sources.map((n: any) => n.type);
      case 'transformer':
        return catalog.transformers.map((n: any) => n.operation);
      case 'target':
        return catalog.targets.map((n: any) => n.type);
      case 'system':
        return catalog.system.map((n: any) => n.type);
      default:
        return [];
    }
  }

  /**
   * Get propagation rule for a transformer operation
   */
  getPropagationRule(operation: string) {
    const rules = this.getPropagationRules();
    return rules.propagationRules.transformer.operationRules[operation];
  }

  /**
   * Get validation rules by category
   */
  getValidationRulesByCategory(category: 'graph' | 'node' | 'edge' | 'type' | 'expression' | 'config') {
    const rules = this.getValidationRules();
    const key = `${category}Validation`;
    return rules[key] || [];
  }

  /**
   * Get type system from graph spec
   */
  getTypeSystem() {
    return this.getGraphSpec().typeSystem;
  }

  /**
   * Get expression grammar from graph spec
   */
  getExpressionGrammar() {
    return this.getGraphSpec().expressionGrammar;
  }

  /**
   * Get ID conventions from graph spec
   */
  getIDConventions() {
    return this.getGraphSpec().idConvention;
  }

  /**
   * Get handle conventions from graph spec
   */
  getHandleConventions() {
    return this.getGraphSpec().handleConvention;
  }

  /**
   * Check if a node type is valid
   */
  isValidNodeType(nodeType: string, subType: string): boolean {
    const def = this.getNodeDefinition(nodeType as any, subType);
    return def !== null && def !== undefined;
  }

  /**
   * Check if types are compatible
   */
  areTypesCompatible(sourceType: string, targetType: string): boolean {
    const typeSystem = this.getTypeSystem();
    const compatibleTypes = typeSystem.typeCompatibility[sourceType] || [];
    return compatibleTypes.includes(targetType);
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.resources) {
      throw new Error('ResourceRegistry not initialized. Call initialize() first.');
    }
  }

  /**
   * Reload all resources (for development/testing)
   */
  async reload(): Promise<void> {
    this.loader.clearCache();
    this.initialized = false;
    await this.initialize();
  }
}

// Made with Bob
