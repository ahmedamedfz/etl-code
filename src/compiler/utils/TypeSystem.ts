/**
 * Type System
 * Provides type checking and compatibility validation using graph specification
 */

import { ResourceRegistry } from '../../semantic/ResourceRegistry';

export class TypeSystem {
  private registry: ResourceRegistry;

  constructor() {
    this.registry = ResourceRegistry.getInstance();
  }

  /**
   * Check if two types are compatible for connection
   */
  areTypesCompatible(sourceType: string, targetType: string): boolean {
    const typeSystem = this.registry.getTypeSystem();
    const compatibleTypes = typeSystem.typeCompatibility[sourceType] || [];
    return compatibleTypes.includes(targetType);
  }

  /**
   * Get all types compatible with a given type
   */
  getCompatibleTypes(sourceType: string): string[] {
    const typeSystem = this.registry.getTypeSystem();
    return typeSystem.typeCompatibility[sourceType] || [];
  }

  /**
   * Get all available data types
   */
  getAllTypes(): string[] {
    const typeSystem = this.registry.getTypeSystem();
    return Object.keys(typeSystem.typeCompatibility);
  }

  /**
   * Validate field type
   */
  isValidType(type: string): boolean {
    const typeSystem = this.registry.getTypeSystem();
    return type in typeSystem.typeCompatibility;
  }

  /**
   * Infer type from value
   */
  inferType(value: any): string {
    if (value === null || value === undefined) {
      return 'string'; // Default
    }

    const type = typeof value;
    
    switch (type) {
      case 'number':
        return Number.isInteger(value) ? 'integer' : 'float';
      case 'boolean':
        return 'boolean';
      case 'string':
        // Try to detect date
        if (this.isDateString(value)) {
          return 'date';
        }
        return 'string';
      default:
        return 'string';
    }
  }

  /**
   * Convert type between different naming conventions
   */
  normalizeType(type: string): string {
    const typeMap: Record<string, string> = {
      'int': 'integer',
      'number': 'float',
      'real': 'float',
      'double': 'float',
      'text': 'string',
      'varchar': 'string',
      'char': 'string',
      'bool': 'boolean',
      'datetime': 'date',
      'timestamp': 'date',
      'timestamptz': 'date'
    };

    return typeMap[type.toLowerCase()] || type.toLowerCase();
  }

  /**
   * Get SQL type for a given data type
   */
  toSQLType(type: string): string {
    const sqlTypeMap: Record<string, string> = {
      'integer': 'INTEGER',
      'float': 'REAL',
      'string': 'TEXT',
      'boolean': 'BOOLEAN',
      'date': 'DATETIME',
      'json': 'TEXT'
    };

    return sqlTypeMap[type] || 'TEXT';
  }

  /**
   * Get PostgreSQL type for a given data type
   */
  toPostgresType(type: string): string {
    const pgTypeMap: Record<string, string> = {
      'integer': 'INTEGER',
      'float': 'REAL',
      'string': 'TEXT',
      'boolean': 'BOOLEAN',
      'date': 'TIMESTAMPTZ',
      'json': 'JSONB'
    };

    return pgTypeMap[type] || 'TEXT';
  }

  /**
   * Validate type conversion
   */
  canConvert(fromType: string, toType: string): boolean {
    // Same type is always convertible
    if (fromType === toType) return true;

    // Define conversion rules
    const conversionRules: Record<string, string[]> = {
      'string': ['integer', 'float', 'boolean', 'date'],
      'integer': ['float', 'string'],
      'float': ['integer', 'string'],
      'boolean': ['string', 'integer'],
      'date': ['string']
    };

    const allowedConversions = conversionRules[fromType] || [];
    return allowedConversions.includes(toType);
  }

  /**
   * Get type precedence for implicit conversions
   */
  getTypePrecedence(type: string): number {
    const precedence: Record<string, number> = {
      'boolean': 1,
      'integer': 2,
      'float': 3,
      'date': 4,
      'string': 5,
      'json': 6
    };

    return precedence[type] || 0;
  }

  /**
   * Determine common type for multiple types
   */
  getCommonType(types: string[]): string {
    if (types.length === 0) return 'string';
    if (types.length === 1) return types[0];

    // If all types are the same, return that type
    if (types.every(t => t === types[0])) {
      return types[0];
    }

    // Find type with highest precedence
    let maxPrecedence = -1;
    let commonType = 'string';

    for (const type of types) {
      const precedence = this.getTypePrecedence(type);
      if (precedence > maxPrecedence) {
        maxPrecedence = precedence;
        commonType = type;
      }
    }

    return commonType;
  }

  /**
   * Check if string looks like a date
   */
  private isDateString(value: string): boolean {
    // ISO 8601 format
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return true;
    
    // Try to parse as date
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  /**
   * Validate field type against schema
   */
  validateFieldType(field: any, expectedType: string): { valid: boolean; error?: string } {
    if (!field.type) {
      return { valid: false, error: 'Field type is missing' };
    }

    const normalizedFieldType = this.normalizeType(field.type);
    const normalizedExpectedType = this.normalizeType(expectedType);

    if (normalizedFieldType !== normalizedExpectedType) {
      // Check if conversion is possible
      if (this.canConvert(normalizedFieldType, normalizedExpectedType)) {
        return { valid: true }; // Conversion possible
      }

      return {
        valid: false,
        error: `Type mismatch: expected ${normalizedExpectedType}, got ${normalizedFieldType}`
      };
    }

    return { valid: true };
  }
}

// Made with Bob