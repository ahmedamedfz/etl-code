/**
 * Expression Validator
 * Validates expressions against grammar from etl-graph-generator-specification.json
 * 
 * Supports:
 * - Field references: {{fieldName}}
 * - Operators: ==, !=, <, >, <=, >=, &&, ||, !
 * - Functions: count, sum, avg, min, max, concat, lower, upper, trim
 * - Literals: strings, numbers, booleans
 */

import { ResourceRegistry } from '../../semantic/ResourceRegistry';

export class ExpressionValidator {
  private registry: ResourceRegistry;

  constructor() {
    this.registry = ResourceRegistry.getInstance();
  }

  /**
   * Validate expression syntax
   */
  validate(expression: string, availableFields?: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!expression || expression.trim() === '') {
      errors.push('Expression cannot be empty');
      return { valid: false, errors, warnings };
    }

    // Check balanced brackets
    const bracketCheck = this.checkBalancedBrackets(expression);
    if (!bracketCheck.valid) {
      errors.push(bracketCheck.error!);
    }

    // Extract and validate field references
    const fieldRefs = this.extractFieldReferences(expression);
    if (availableFields) {
      for (const fieldRef of fieldRefs) {
        if (!availableFields.includes(fieldRef)) {
          errors.push(`Field reference not found: ${fieldRef}`);
        }
      }
    }

    // Validate operators
    const operatorCheck = this.validateOperators(expression);
    if (!operatorCheck.valid) {
      errors.push(...operatorCheck.errors);
    }

    // Validate functions
    const functionCheck = this.validateFunctions(expression);
    if (!functionCheck.valid) {
      errors.push(...functionCheck.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Extract field references from expression
   */
  extractFieldReferences(expression: string): string[] {
    const grammar = this.registry.getExpressionGrammar();
    const openToken = grammar.fieldReference.openToken;
    const closeToken = grammar.fieldReference.closeToken;
    
    const regex = new RegExp(`${this.escapeRegex(openToken)}(\\w+)${this.escapeRegex(closeToken)}`, 'g');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(expression)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }

  /**
   * Check if brackets are balanced
   */
  checkBalancedBrackets(expression: string): { valid: boolean; error?: string } {
    const grammar = this.registry.getExpressionGrammar();
    const openToken = grammar.fieldReference.openToken;
    const closeToken = grammar.fieldReference.closeToken;
    
    let count = 0;
    let i = 0;
    
    while (i < expression.length) {
      if (expression.substr(i, openToken.length) === openToken) {
        count++;
        i += openToken.length;
      } else if (expression.substr(i, closeToken.length) === closeToken) {
        count--;
        i += closeToken.length;
      } else {
        i++;
      }
      
      if (count < 0) {
        return { valid: false, error: 'Unbalanced field reference brackets: too many closing brackets' };
      }
    }

    if (count !== 0) {
      return { valid: false, error: 'Unbalanced field reference brackets: unclosed brackets' };
    }

    return { valid: true };
  }

  /**
   * Validate operators in expression
   */
  validateOperators(expression: string): { valid: boolean; errors: string[] } {
    const grammar = this.registry.getExpressionGrammar();
    const validOperators = grammar.operators;
    const errors: string[] = [];

    // Remove field references and string literals to avoid false positives
    let cleaned = expression.replace(/\{\{[^}]+\}\}/g, 'FIELD');
    cleaned = cleaned.replace(/'[^']*'/g, 'STRING');
    cleaned = cleaned.replace(/"[^"]*"/g, 'STRING');

    // Check for invalid operator patterns
    const operatorPattern = /([<>=!&|]+)/g;
    let match;

    while ((match = operatorPattern.exec(cleaned)) !== null) {
      const operator = match[1];
      if (!validOperators.includes(operator)) {
        errors.push(`Invalid operator: ${operator}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate functions in expression
   */
  validateFunctions(expression: string): { valid: boolean; errors: string[] } {
    const grammar = this.registry.getExpressionGrammar();
    const validFunctions = grammar.functions;
    const errors: string[] = [];

    // Extract function calls
    const functionPattern = /(\w+)\s*\(/g;
    let match;

    while ((match = functionPattern.exec(expression)) !== null) {
      const funcName = match[1].toLowerCase();
      if (!validFunctions.includes(funcName)) {
        errors.push(`Unknown function: ${funcName}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Parse expression into tokens
   */
  tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    const grammar = this.registry.getExpressionGrammar();
    
    let i = 0;
    while (i < expression.length) {
      // Skip whitespace
      if (/\s/.test(expression[i])) {
        i++;
        continue;
      }

      // Field reference
      if (expression.substr(i, 2) === '{{') {
        const end = expression.indexOf('}}', i);
        if (end !== -1) {
          const fieldName = expression.substring(i + 2, end);
          tokens.push({ type: 'field', value: fieldName });
          i = end + 2;
          continue;
        }
      }

      // String literal
      if (expression[i] === '"' || expression[i] === "'") {
        const quote = expression[i];
        const end = expression.indexOf(quote, i + 1);
        if (end !== -1) {
          const value = expression.substring(i + 1, end);
          tokens.push({ type: 'string', value });
          i = end + 1;
          continue;
        }
      }

      // Number
      if (/\d/.test(expression[i])) {
        let num = '';
        while (i < expression.length && /[\d.]/.test(expression[i])) {
          num += expression[i];
          i++;
        }
        tokens.push({ type: 'number', value: num });
        continue;
      }

      // Operator
      const twoCharOp = expression.substr(i, 2);
      if (grammar.operators.includes(twoCharOp)) {
        tokens.push({ type: 'operator', value: twoCharOp });
        i += 2;
        continue;
      }

      const oneCharOp = expression[i];
      if (grammar.operators.includes(oneCharOp)) {
        tokens.push({ type: 'operator', value: oneCharOp });
        i++;
        continue;
      }

      // Function or identifier
      if (/[a-zA-Z_]/.test(expression[i])) {
        let ident = '';
        while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) {
          ident += expression[i];
          i++;
        }
        
        // Check if it's a function (followed by '(')
        if (i < expression.length && expression[i] === '(') {
          tokens.push({ type: 'function', value: ident });
        } else {
          tokens.push({ type: 'identifier', value: ident });
        }
        continue;
      }

      // Other characters (parentheses, commas, etc.)
      tokens.push({ type: 'symbol', value: expression[i] });
      i++;
    }

    return tokens;
  }

  /**
   * Evaluate expression (basic evaluation for constants)
   */
  evaluateConstant(expression: string): any {
    // Remove whitespace
    const expr = expression.trim();

    // Boolean literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    // Number literals
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }

    // String literals
    if ((expr.startsWith('"') && expr.endsWith('"')) ||
        (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }

    return null;
  }

  /**
   * Get expression type (for type inference)
   */
  inferExpressionType(expression: string): string {
    const tokens = this.tokenize(expression);
    
    // Check for functions
    const funcToken = tokens.find(t => t.type === 'function');
    if (funcToken) {
      const funcName = funcToken.value.toLowerCase();
      if (['count', 'sum'].includes(funcName)) return 'integer';
      if (['avg', 'min', 'max'].includes(funcName)) return 'float';
      if (['concat', 'lower', 'upper', 'trim'].includes(funcName)) return 'string';
    }

    // Check for operators
    const hasComparison = tokens.some(t => 
      t.type === 'operator' && ['==', '!=', '<', '>', '<=', '>='].includes(t.value)
    );
    if (hasComparison) return 'boolean';

    const hasLogical = tokens.some(t => 
      t.type === 'operator' && ['&&', '||', '!'].includes(t.value)
    );
    if (hasLogical) return 'boolean';

    // Default to string
    return 'string';
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface Token {
  type: 'field' | 'string' | 'number' | 'operator' | 'function' | 'identifier' | 'symbol';
  value: string;
}

// Made with Bob