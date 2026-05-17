import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AIResponseSchema } from '../types';

export interface AIServiceConfig {
    apiKey: string;
    endpointUrl?: string; // IBM Bob Inference Endpoint
}

export class AIService {
    private apiKey: string;
    private endpointUrl: string;

    constructor(config: AIServiceConfig) {
        this.apiKey = config.apiKey;
        this.endpointUrl = config.endpointUrl || 'https://api.example-ibm-bob.com/v1/generate';
    }

    async testInferenceEndpoint(): Promise<boolean> {
        try {
            const response = await axios.post(
                this.endpointUrl,
                { prompt: 'Test connection', maxTokens: 5 },
                { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 5000 }
            );
            return response.status === 200;
        } catch (error) {
            console.error('AI inference endpoint test failed', error);
            return false;
        }
    }

    /**
     * Generates a field mapping from source to target schema.
     * Uses a structured few-shot prompt for better, deterministic AI outputs.
     * Retries on failure and falls back to a precomputed JSON file.
     */
    async generateMapping(sourceSchema: any, targetSchema: any, retries = 2): Promise<AIResponseSchema> {
        const prompt = this.buildMappingPrompt(sourceSchema, targetSchema);

        let attempt = 0;
        while (attempt <= retries) {
            try {
                const response = await axios.post(
                    this.endpointUrl,
                    {
                        prompt,
                        maxTokens: 400,      // Shorter response tokens for faster inference
                        temperature: 0.0,    // Fully deterministic output for demo stability
                        responseFormat: 'json'
                    },
                    {
                        headers: { Authorization: `Bearer ${this.apiKey}` },
                        timeout: 10000       // DB connection timeout handling
                    }
                );

                // Invalid JSON recovery: extract JSON block from raw text
                const rawText = response.data.text ?? response.data.choices?.[0]?.text ?? response.data;
                return this.parseJsonResponse(rawText);
            } catch (error) {
                console.warn(`AI Mapping attempt ${attempt + 1} of ${retries + 1} failed`, error);
                attempt++;
            }
        }

        // Cached fallback AI response (precomputed file on disk, then runtime name-match)
        console.warn('All AI retries exhausted. Using cached fallback response.');
        return this.getPrecomputedFallback() ?? this.getRuntimeFallback(sourceSchema, targetSchema);
    }

    /**
     * Better mapping prompt: structured, concise, few-shot example included.
     * JSON-only output is enforced via explicit instructions and format examples.
     */
    private buildMappingPrompt(sourceSchema: any, targetSchema: any): string {
        return `You are an expert ETL data mapper. Your task is to map source fields to target fields.

RULES:
- Respond with ONLY a valid JSON object. No markdown, no prose, no explanation outside the JSON.
- Assign a confidenceScore between 0 and 1 for each mapping.
- If a transformation is needed (e.g. type cast), set transformLogic to a JS expression using "value".
- If a field cannot be mapped, omit it.

EXAMPLE INPUT:
Source: [{"name":"cust_id","type":"number"},{"name":"full_name","type":"string"}]
Target: [{"name":"customer_id","type":"number"},{"name":"name","type":"string"}]

EXAMPLE OUTPUT:
{"mapping":[{"sourceField":"cust_id","targetField":"customer_id","confidenceScore":0.98},{"sourceField":"full_name","targetField":"name","confidenceScore":0.95}],"explanation":"Matched by semantic similarity."}

NOW MAP:
Source: ${JSON.stringify(sourceSchema)}
Target: ${JSON.stringify(targetSchema)}`;
    }

    /**
     * Extracts and parses the first valid JSON object from an AI response string.
     * Handles cases where the model wraps the JSON in markdown code fences.
     */
    private parseJsonResponse(rawText: any): AIResponseSchema {
        if (typeof rawText === 'object' && rawText !== null) {
            return rawText as AIResponseSchema;
        }
        const text = String(rawText);
        // Strip markdown code fences if present
        const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '');
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`No valid JSON found in AI response: ${text.slice(0, 200)}`);
        }
        return JSON.parse(jsonMatch[0]) as AIResponseSchema;
    }

    /**
     * Loads the precomputed fallback mapping from disk (src/ai/fallback-mapping.json).
     * Returns null if the file is missing or malformed.
     */
    private getPrecomputedFallback(): AIResponseSchema | null {
        try {
            const filePath = path.join(__dirname, 'fallback-mapping.json');
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf-8');
                const parsed = JSON.parse(raw) as AIResponseSchema;
                console.warn('Using precomputed AI output from fallback-mapping.json');
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to load precomputed fallback mapping', e);
        }
        return null;
    }

    /**
     * Runtime name-match fallback: pairs source and target fields by exact or partial name.
     * Used as last resort when the disk file is also unavailable.
     */
    private getRuntimeFallback(sourceSchema: any[], targetSchema: any[]): AIResponseSchema {
        const mapping: AIResponseSchema['mapping'] = [];
        for (const src of sourceSchema) {
            const target = targetSchema.find(
                (t: any) =>
                    t.name.toLowerCase() === src.name.toLowerCase() ||
                    t.name.toLowerCase().includes(src.name.toLowerCase())
            );
            if (target) {
                mapping.push({ sourceField: src.name, targetField: target.name, confidenceScore: 0.75 });
            }
        }
        return {
            mapping,
            explanation: 'Generated using runtime name-match fallback. AI service was unavailable.'
        };
    }
}
