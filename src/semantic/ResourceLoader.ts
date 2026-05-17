/**
 * Semantic Resource Loader
 * Loads and caches JSON knowledge files as semantic contracts
 * These are NOT config files - they are compiler specifications
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface SemanticResources {
  compilerPipeline: any;
  graphSpec: any;
  nodeCatalog: any;
  propagationRules: any;
  validationRules: any;
  promptTemplates: any;
  examplePatterns: any;
}

export class ResourceLoader {
  private resourcePath: string;
  private cache = new Map<string, any>();

  constructor(resourcePath: string = path.join(__dirname, '../../resources')) {
    this.resourcePath = resourcePath;
  }

  /**
   * Load all semantic resources
   */
  async loadAll(): Promise<SemanticResources> {
    return {
      compilerPipeline: await this.load('compiler-pipeline.json'),
      graphSpec: await this.load('etl-graph-generator-specification.json'),
      nodeCatalog: await this.load('node-catalog.json'),
      propagationRules: await this.load('field-propagation-rules.json'),
      validationRules: await this.load('validation-rules.json'),
      promptTemplates: await this.load('prompt-templates.json'),
      examplePatterns: await this.load('example-patterns.json')
    };
  }

  /**
   * Load a specific resource with caching
   */
  async load<T = any>(filename: string): Promise<T> {
    if (this.cache.has(filename)) {
      return this.cache.get(filename) as T;
    }

    const filePath = path.join(this.resourcePath, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    
    this.cache.set(filename, parsed);
    return parsed as T;
  }

  /**
   * Clear cache (for hot-reload during development)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if resource file exists
   */
  async exists(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.resourcePath, filename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Made with Bob
