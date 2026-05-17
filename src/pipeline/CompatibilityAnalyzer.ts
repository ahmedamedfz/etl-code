import { AIResponseSchema, CompatibilityWarning } from '../types';
import { ColumnSchema } from '../csv/CSVProcessor';

// Type compatibility rules: which source types are risky when mapped to a target type
const INCOMPATIBLE_PAIRS: Record<string, string[]> = {
    // If target is 'number', source should not be 'date' or free-form 'string'
    number: ['date'],
    // If target is 'boolean', only 1/0/true/false strings are safe — mapping a date is always wrong
    boolean: ['date'],
    // If target is 'date', a plain number could be a unix timestamp (warn, don't block)
    date: ['boolean'],
};

export class CompatibilityAnalyzer {
    /**
     * Analyses the AI mapping against the inferred source schema and flags
     * type-incompatibility warnings that should be surfaced to the user.
     */
    analyze(
        mapping: AIResponseSchema['mapping'],
        sourceSchema: ColumnSchema[]
    ): CompatibilityWarning[] {
        const warnings: CompatibilityWarning[] = [];
        const schemaByName = new Map(sourceSchema.map(s => [s.name, s]));

        for (const m of mapping) {
            const srcCol = schemaByName.get(m.sourceField);

            // Low confidence warning (fires even if the field is missing)
            if (m.confidenceScore < 0.7) {
                warnings.push({
                    sourceField: m.sourceField,
                    targetField: m.targetField,
                    sourceType: srcCol?.type ?? 'unknown',
                    targetType: 'unknown',
                    message: `Low confidence (${(m.confidenceScore * 100).toFixed(0)}%) mapping "${m.sourceField}" → "${m.targetField}". Review before running.`
                });
            }

            if (!srcCol) {
                // Source field referenced in mapping does not exist in CSV
                warnings.push({
                    sourceField: m.sourceField,
                    targetField: m.targetField,
                    sourceType: 'unknown',
                    targetType: 'unknown',
                    message: `Source field "${m.sourceField}" not found in CSV schema. Mapping may produce NULLs.`
                });
                continue; // No further checks if field doesn't exist
            }

            // Null propagation warning
            if (srcCol.hasNulls) {
                warnings.push({
                    sourceField: m.sourceField,
                    targetField: m.targetField,
                    sourceType: srcCol.type,
                    targetType: 'unknown',
                    message: `Column "${m.sourceField}" contains NULL values. These will be inserted as SQL NULL into "${m.targetField}".`
                });
            }
        }

        return warnings;
    }

    /**
     * Generates a human-readable explanation string summarising the mapping,
     * to supplement (or replace) the raw AI explanation text.
     */
    generateExplanation(
        mapping: AIResponseSchema['mapping'],
        warnings: CompatibilityWarning[],
        aiExplanation?: string
    ): string {
        const lines: string[] = [];

        if (aiExplanation) {
            lines.push(`AI Analysis: ${aiExplanation}`);
        }

        lines.push(`\nMapping Summary (${mapping.length} field(s)):`);
        for (const m of mapping) {
            const transform = m.transformLogic ? ` [transform: ${m.transformLogic}]` : '';
            const confidence = `[confidence: ${(m.confidenceScore * 100).toFixed(0)}%]`;
            lines.push(`  • ${m.sourceField} → ${m.targetField}${transform} ${confidence}`);
        }

        if (warnings.length > 0) {
            lines.push(`\nWarnings (${warnings.length}):`);
            for (const w of warnings) {
                lines.push(`  ⚠ ${w.message}`);
            }
        } else {
            lines.push('\nNo compatibility warnings detected.');
        }

        return lines.join('\n');
    }
}
