import axios from 'axios';
import { AIResponseSchema } from '../types';

export interface AIServiceConfig {
    apiKey: string;
    endpointUrl?: string; // e.g. IBM Bob Inference Endpoint
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
            // A simple test call to verify API key and endpoint
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

    async generateMapping(sourceSchema: any, targetSchema: any, retries = 2): Promise<AIResponseSchema> {
        const prompt = `
            You are an expert ETL data mapper.
            Source schema: ${JSON.stringify(sourceSchema)}
            Target schema: ${JSON.stringify(targetSchema)}
            Provide a JSON mapping from source to target.
            Return ONLY valid JSON matching this schema:
            {
                "mapping": [
                    {
                        "sourceField": "string",
                        "targetField": "string",
                        "transformLogic": "string (optional)",
                        "confidenceScore": "number (0-1)"
                    }
                ],
                "sqlTemplate": "string (optional)",
                "explanation": "string (optional)"
            }
        `;

        let attempt = 0;
        while (attempt <= retries) {
            try {
                const response = await axios.post(
                    this.endpointUrl,
                    { 
                        prompt, 
                        maxTokens: 500, // Shorter response tokens
                        temperature: 0.1, // Stable AI outputs (deterministic enough)
                        responseFormat: 'json'
                    },
                    { 
                        headers: { Authorization: `Bearer ${this.apiKey}` },
                        timeout: 10000 // Timeout handling
                    }
                );

                const rawText = response.data.text || response.data.choices?.[0]?.text || response.data;
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                const jsonString = jsonMatch ? jsonMatch[0] : rawText;
                
                return JSON.parse(jsonString) as AIResponseSchema;
            } catch (error) {
                console.warn(`AI Mapping attempt ${attempt + 1} failed`, error);
                attempt++;
            }
        }

        // Cached fallback AI response if all retries fail
        console.warn('All AI retries failed, using cached fallback response');
        return this.getFallbackMapping(sourceSchema, targetSchema);
    }

    private getFallbackMapping(sourceSchema: any, targetSchema: any): AIResponseSchema {
        // Very basic fallback logic matching exact names
        const mapping: any[] = [];
        for (const src of sourceSchema) {
            const target = targetSchema.find((t: any) => t.name.toLowerCase() === src.name.toLowerCase() || t.name.toLowerCase().includes(src.name.toLowerCase()));
            if (target) {
                mapping.push({
                    sourceField: src.name,
                    targetField: target.name,
                    confidenceScore: 0.8
                });
            }
        }
        
        return {
            mapping,
            explanation: 'Generated using offline fallback logic due to AI service unavailability.'
        };
    }
}
