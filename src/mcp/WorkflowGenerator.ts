/**
 * WorkflowGenerator — converts a natural language ETL description into
 * a valid version-1 workflow JSON (React Flow graph format).
 *
 * This is the canonical format expected by the ETL canvas frontend.
 * IBM Bob calls `generate_etl_workflow` with a description and gets back
 * a JSON that can be loaded directly into the canvas.
 *
 * The generator uses keyword detection to build the correct node/edge graph.
 * When an AI endpoint is available, it will be used instead.
 */

export interface WorkflowField {
    id: string;
    name: string;
    type: string;
}

export interface WorkflowNode {
    id: string;
    type: 'source' | 'transformer' | 'target' | 'system';
    data: Record<string, any>;
}

export interface WorkflowEdge {
    id: string;
    type: 'smoothstep';
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
    data: { mode: 'field' | 'node' };
}

export interface WorkflowJSON {
    version: 1;
    format: 'full';
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

const DEFAULT_SOURCE_COLUMNS = ['id', 'name', 'value', 'created_at'];

// ── Edge builder helper ───────────────────────────────────────────────────────
function edge(
    src: string, srcHandle: string,
    tgt: string, tgtHandle: string,
    mode: 'field' | 'node' = 'field'
): WorkflowEdge {
    return {
        id:   `edge_${src}_${srcHandle}_${tgt}_${tgtHandle}`,
        type: 'smoothstep',
        source: src, sourceHandle: `output-${srcHandle}`,
        target: tgt, targetHandle: `input-${tgtHandle}`,
        data: { mode }
    };
}

// ── Keyword detector ──────────────────────────────────────────────────────────
interface ParsedIntent {
    sourceFile:      string;
    sourceType:      'csv' | 'json' | 'api';
    targetTable:     string;
    targetType:      'sqlite' | 'postgres' | 'oracle';
    hasFilter:       boolean;
    filterField:     string;
    hasAggregate:    boolean;
    aggregateField:  string;
    hasMap:          boolean;
    mapField:        string;
    mapExpression:   string;
    hasSequentialId: boolean;
    hasTimestamp:    boolean;
    sourceFields:    WorkflowField[];
    targetFields:    WorkflowField[];
}

function parseDescription(desc: string): ParsedIntent {
    const d = desc.toLowerCase();
    const sourceFile = extractSourceFile(desc);
    const targetTable = extractTargetTable(desc);
    const columnNames = extractColumnNames(desc);
    const sourceFields = buildSourceFields(columnNames);
    const targetFields = buildTargetFields(sourceFields);

    return {
        sourceFile,
        sourceType:      d.includes('api') || /^https?:\/\//i.test(sourceFile) ? 'api'
                       : d.includes('json') ? 'json'
                       : 'csv',
        targetTable,
        targetType:      d.includes('postgres') || d.includes('supabase') ? 'postgres'
                       : d.includes('oracle')                             ? 'oracle'
                       : 'sqlite',
        hasFilter:       d.includes('filter') || d.includes('timestamp') || d.includes('before'),
        filterField:     sourceFields[0]?.name || 'created_at',
        hasAggregate:    d.includes('aggregate') || d.includes('group') || d.includes('count'),
        aggregateField:  sourceFields[1]?.name || sourceFields[0]?.name || 'id',
        hasMap:          d.includes('map') || d.includes('convert') || d.includes('real'),
        mapField:        sourceFields[2]?.name || sourceFields[0]?.name || 'value',
        mapExpression:   `REAL({{${sourceFields[2]?.name || sourceFields[0]?.name || 'value'}}})`,
        hasSequentialId: d.includes('sequential') || d.includes('id') || d.includes('sequence'),
        hasTimestamp:    d.includes('timestamp') || d.includes('filter') || d.includes('datetime'),
        sourceFields,
        targetFields,
    };
}

function extractSourceFile(desc: string): string {
    return desc.match(/https?:\/\/[^\s,;]+/i)?.[0] ||
        desc.match(/(?:load|read|from)\s+([^\s,]+)/i)?.[1] ||
        '/path/to/data.csv';
}

function extractTargetTable(desc: string): string {
    const destinationMatch = desc.match(/(?:save|write|insert)\s+(?:to|into)\s+(?:(?:sqlite|postgres|postgresql|supabase|oracle|mysql)\s+)?(\w+)/i);
    const destination = destinationMatch?.[1];

    if (destination && !isTargetTypeWord(destination)) {
        return destination;
    }

    return desc.match(/table\s+(\w+)/i)?.[1] ||
        deriveTableNameFromSource(extractSourceFile(desc)) ||
        'etl_output';
}

function deriveTableNameFromSource(source: string): string | undefined {
    if (!/^https?:\/\//i.test(source)) {
        return undefined;
    }

    return new URL(source).pathname.split('/').filter(Boolean).pop()?.replace(/[^a-zA-Z0-9_]/g, '_');
}

function isTargetTypeWord(value: string): boolean {
    return ['sqlite', 'postgres', 'postgresql', 'supabase', 'oracle', 'mysql'].includes(value.toLowerCase());
}

function extractColumnNames(desc: string): string[] {
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

function buildSourceFields(columnNames: string[]): WorkflowField[] {
    return columnNames.map((name, index) => ({
        id: `col_${index}`,
        name,
        type: inferFieldType(name)
    }));
}

function buildTargetFields(sourceFields: WorkflowField[]): WorkflowField[] {
    return sourceFields.map((field, index) => ({
        id: `sql_col_${index}`,
        name: toSnakeCase(field.name),
        type: toSqlFieldType(field.type)
    }));
}

function inferFieldType(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.includes('date') || normalized.includes('time') || normalized.endsWith('_at')) {return 'datetime';}
    if (normalized.startsWith('is_') || normalized.startsWith('has_')) {return 'boolean';}
    if (normalized.includes('id') || normalized.includes('count') || normalized.includes('qty')) {return 'integer';}
    if (normalized.includes('amount') || normalized.includes('price') || normalized.includes('total') || normalized.includes('value')) {return 'float';}
    return 'string';
}

function toSqlFieldType(type: string): string {
    if (type === 'float') {return 'real';}
    if (type === 'string') {return 'text';}
    return type;
}

function toSnakeCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

// ── Main generator ────────────────────────────────────────────────────────────
export function generateWorkflowFromDescription(description: string, _format: string = 'full'): WorkflowJSON {
    const intent = parseDescription(description);
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    const sourceFields  = intent.sourceFields;
    const targetFields  = intent.targetFields;
    const connectionStr = intent.targetType === 'sqlite'
        ? '/path/to/sqlite.db'
        : `${intent.targetType}://user:pass@host:5432/${intent.targetTable}`;

    // ── node_1: CSV Source ────────────────────────────────────────────────────
    nodes.push({
        id:   'node_1',
        type: 'source',
        data: {
            label:      'New CSV Source',
            sourceType: intent.sourceType,
            config: {
                filePath:  intent.sourceFile,
                delimiter: ',',
                skipRows:  0
            },
            outputFields: sourceFields
        }
    });

    let nextNodeId = 2;

    // ── node_4 + node_3: CurrentDatetime + FILTER ─────────────────────────────
    if (intent.hasTimestamp) {
        nodes.push({
            id:   'node_4',
            type: 'system',
            data: {
                label:      'Current Datetime',
                systemType: 'current-datetime',
                config: { fieldName: 'current_timestamp', format: 'iso' },
                outputFields: [{ id: 'out_datetime', name: 'current_timestamp', type: 'datetime' }]
            }
        });
        nodes.push({
            id:   'node_3',
            type: 'transformer',
            data: {
                label:     'New FILTER',
                operation: 'filter',
                config: { condition: `{{${intent.filterField}}}<{{current_timestamp}}` },
                inputFields: [
                    { id: 'out_datetime', name: 'current_timestamp', type: 'datetime' },
                    { id: 'col_0',        name: intent.filterField,  type: 'date'     }
                ],
                outputFields: [
                    { id: 'out_datetime', name: 'current_timestamp', type: 'datetime' },
                    { id: 'col_0',        name: intent.filterField,  type: 'date'     }
                ],
                mappings: []
            }
        });
        edges.push(edge('node_4', 'out_datetime', 'node_3', 'out_datetime'));
        edges.push(edge('node_1', 'col_0',        'node_3', 'col_0'));
        nextNodeId = 5;
    }

    // ── node_5: AGGREGATE ─────────────────────────────────────────────────────
    if (intent.hasAggregate) {
        nodes.push({
            id:   `node_${nextNodeId}`,
            type: 'transformer',
            data: {
                label:     'New AGGREGATE',
                operation: 'aggregate',
                config: {
                    groupBy:      `{{${intent.aggregateField}}}`,
                    aggregations: `Count({{${intent.aggregateField}}})`
                },
                inputFields:  [sourceFields.find(f => f.name === intent.aggregateField) || sourceFields[0]],
                outputFields: [
                    { id: 'agg_1', name: 'group_key',   type: 'string' },
                    { id: 'agg_2', name: 'total_count', type: 'number' }
                ],
                mappings: []
            }
        });
        const aggregateField = sourceFields.find(f => f.name === intent.aggregateField) || sourceFields[0];
        edges.push(edge('node_1', aggregateField.id, `node_${nextNodeId}`, aggregateField.id));
        nextNodeId++;
    }

    // ── node_6: Target ────────────────────────────────────────────────────────
    const targetNodeId = 'node_6';
    nodes.push({
        id:   targetNodeId,
        type: 'target',
        data: {
            label:      `New ${intent.targetType.toUpperCase()} Target`,
            targetType: intent.targetType,
            config: {
                connectionString: connectionStr,
                table:            intent.targetTable,
                mode:             'append'
            },
            inputFields: targetFields
        }
    });

    // ── node_7: Sequential ID ─────────────────────────────────────────────────
    if (intent.hasSequentialId) {
        nodes.push({
            id:   'node_7',
            type: 'system',
            data: {
                label:      'Sequential Id',
                systemType: 'sequential-id',
                config: { fieldName: 'sequence_id', startAt: 1, step: 1 },
                outputFields: [{ id: 'out_seq', name: 'sequence_id', type: 'number' }]
            }
        });
        edges.push(edge('node_7', 'out_seq', targetNodeId, 'sql_col_0'));
    }

    // ── node_8: MAP transformer ───────────────────────────────────────────────
    if (intent.hasMap) {
        nodes.push({
            id:   'node_8',
            type: 'transformer',
            data: {
                label:     'New MAP',
                operation: 'map',
                config: {
                    targetColumn: '',
                    expression:   intent.mapExpression
                },
                inputFields:  [sourceFields.find(f => f.name === intent.mapField) || sourceFields[0]],
                outputFields: [sourceFields.find(f => f.name === intent.mapField) || sourceFields[0]],
                mappings: []
            }
        });
        const mapField = sourceFields.find(f => f.name === intent.mapField) || sourceFields[0];
        const mapTarget = targetFields.find(f => f.name === toSnakeCase(mapField.name)) || targetFields[0];
        edges.push(edge('node_1',  mapField.id, 'node_8', mapField.id));
        edges.push(edge('node_8',  mapField.id, targetNodeId, mapTarget.id));
    }

    // ── Direct source → target edges ─────────────────────────────────────────
    sourceFields.forEach((sourceField, index) => {
        const targetField = targetFields[index];
        if (!targetField) {return;}
        const sourceNodeId = intent.hasTimestamp && index === 0 ? 'node_3' : 'node_1';
        edges.push(edge(sourceNodeId, sourceField.id, targetNodeId, targetField.id));
    });

    return { version: 1, format: 'full', nodes, edges };
}
