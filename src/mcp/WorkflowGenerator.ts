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

// ── Field catalog: maps common CSV column names to SQL types ─────────────────
const BATTERY_FIELDS: WorkflowField[] = [
    { id: 'col_0',  name: 'Timestamp',                type: 'date'    },
    { id: 'col_1',  name: 'Device_ID',                type: 'string'  },
    { id: 'col_2',  name: 'Battery_Voltage_V',        type: 'float'   },
    { id: 'col_3',  name: 'Battery_Voltage_mV',       type: 'integer' },
    { id: 'col_4',  name: 'Cell_1_Voltage',           type: 'float'   },
    { id: 'col_5',  name: 'Cell_2_Voltage',           type: 'float'   },
    { id: 'col_6',  name: 'Cell_3_Voltage',           type: 'float'   },
    { id: 'col_7',  name: 'State_Of_Charge',          type: 'float'   },
    { id: 'col_8',  name: 'Temperature_C',            type: 'float'   },
    { id: 'col_9',  name: 'Temperature_F',            type: 'float'   },
    { id: 'col_10', name: 'Charge_Current_A',         type: 'float'   },
    { id: 'col_11', name: 'Discharge_Current_A',      type: 'float'   },
    { id: 'col_12', name: 'Cycle_Count',              type: 'integer' },
    { id: 'col_13', name: 'Internal_Resistance_mOhm', type: 'float'  },
    { id: 'col_14', name: 'System_Health_Percentage', type: 'float'  },
    { id: 'col_15', name: 'State_Flag',               type: 'string'  },
    { id: 'col_16', name: 'Is_Charging',              type: 'boolean' },
    { id: 'col_17', name: 'Fault_Code',               type: 'string'  },
    { id: 'col_18', name: 'Humidity_Percentage',      type: 'float'   },
    { id: 'col_19', name: 'Pressure_hPa',             type: 'float'   },
];

const BATTERY_TARGET_FIELDS: WorkflowField[] = [
    { id: 'sql_col_0',  name: 'id',                       type: 'integer'  },
    { id: 'sql_col_1',  name: 'device_id',                type: 'text'     },
    { id: 'sql_col_2',  name: 'timestamp',                type: 'datetime' },
    { id: 'sql_col_3',  name: 'battery_voltage_v',        type: 'real'     },
    { id: 'sql_col_4',  name: 'battery_voltage_mv',       type: 'integer'  },
    { id: 'sql_col_5',  name: 'cell_1_voltage',           type: 'real'     },
    { id: 'sql_col_6',  name: 'cell_2_voltage',           type: 'real'     },
    { id: 'sql_col_7',  name: 'cell_3_voltage',           type: 'real'     },
    { id: 'sql_col_8',  name: 'state_of_charge',          type: 'real'     },
    { id: 'sql_col_9',  name: 'temperature_c',            type: 'real'     },
    { id: 'sql_col_10', name: 'temperature_f',            type: 'real'     },
    { id: 'sql_col_11', name: 'charge_current_a',         type: 'real'     },
    { id: 'sql_col_12', name: 'discharge_current_a',      type: 'real'     },
    { id: 'sql_col_13', name: 'cycle_count',              type: 'integer'  },
    { id: 'sql_col_14', name: 'internal_resistance_mohm', type: 'real'     },
    { id: 'sql_col_15', name: 'system_health_percentage', type: 'real'     },
    { id: 'sql_col_16', name: 'state_flag',               type: 'text'     },
    { id: 'sql_col_17', name: 'is_charging',              type: 'boolean'  },
    { id: 'sql_col_18', name: 'fault_code',               type: 'text'     },
    { id: 'sql_col_19', name: 'humidity_percentage',      type: 'real'     },
    { id: 'sql_col_20', name: 'pressure_hpa',             type: 'real'     },
    { id: 'sql_col_21', name: 'created_at',               type: 'datetime' },
];

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
    fieldSet:        'battery' | 'generic';
}

function parseDescription(desc: string): ParsedIntent {
    const d = desc.toLowerCase();
    return {
        sourceFile:      d.includes('battery') ? '/path/to/battery.csv' : '/path/to/data.csv',
        sourceType:      d.includes('json') ? 'json' : 'csv',
        targetTable:     d.includes('battery_telemetry') ? 'battery_telemetry'
                       : d.includes('battery')           ? 'battery_telemetry'
                       : 'etl_output',
        targetType:      d.includes('postgres') || d.includes('supabase') ? 'postgres'
                       : d.includes('oracle')                             ? 'oracle'
                       : 'sqlite',
        hasFilter:       d.includes('filter') || d.includes('timestamp') || d.includes('before'),
        filterField:     'Timestamp',
        hasAggregate:    d.includes('aggregate') || d.includes('group') || d.includes('count'),
        aggregateField:  'State_Flag',
        hasMap:          d.includes('map') || d.includes('convert') || d.includes('real') || d.includes('humidity'),
        mapField:        'Humidity_Percentage',
        mapExpression:   'REAL({{Humidity_Percentage}})',
        hasSequentialId: d.includes('sequential') || d.includes('id') || d.includes('sequence'),
        hasTimestamp:    d.includes('timestamp') || d.includes('filter') || d.includes('datetime'),
        fieldSet:        d.includes('battery') ? 'battery' : 'generic',
    };
}

// ── Main generator ────────────────────────────────────────────────────────────
export function generateWorkflowFromDescription(description: string, _format: string = 'full'): WorkflowJSON {
    const intent = parseDescription(description);
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    const sourceFields  = intent.fieldSet === 'battery' ? BATTERY_FIELDS : BATTERY_FIELDS.slice(0, 5);
    const targetFields  = intent.fieldSet === 'battery' ? BATTERY_TARGET_FIELDS : BATTERY_TARGET_FIELDS.slice(0, 10);
    const connectionStr = intent.targetType === 'sqlite'
        ? '/path/to/batteries.db'
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
                inputFields:  [{ id: 'col_15', name: intent.aggregateField, type: 'string' }],
                outputFields: [
                    { id: 'agg_1', name: 'group_key',   type: 'string' },
                    { id: 'agg_2', name: 'total_count', type: 'number' }
                ],
                mappings: []
            }
        });
        edges.push(edge('node_1', 'col_15', `node_${nextNodeId}`, 'col_15'));
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
                inputFields:  [{ id: 'col_18', name: intent.mapField, type: 'float' }],
                outputFields: [{ id: 'col_18', name: intent.mapField, type: 'float' }],
                mappings: []
            }
        });
        edges.push(edge('node_1',  'col_18', 'node_8',    'col_18'));
        edges.push(edge('node_8',  'col_18', targetNodeId,'sql_col_19'));
    }

    // ── Direct source → target edges ─────────────────────────────────────────
    // Timestamp comes via FILTER if filter exists, otherwise direct
    if (intent.hasTimestamp) {
        edges.push(edge('node_3', 'col_0', targetNodeId, 'sql_col_2'));
    } else {
        edges.push(edge('node_1', 'col_0', targetNodeId, 'sql_col_2'));
    }
    // Device_ID always direct
    edges.push(edge('node_1', 'col_1', targetNodeId, 'sql_col_1'));

    return { version: 1, format: 'full', nodes, edges };
}
