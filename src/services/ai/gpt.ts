import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'dummy_key_for_build',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://dummy.openai.azure.com',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
});

// Using standard GPT-4o deployments
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID || 'gpt-4o';

export interface ParsedKnowledge {
    title: string;
    category: 'commercial' | 'technical' | 'quirks' | 'other';
    content: string;
    tags: string[];
}

export async function extractAndRedactKnowledge(rawText: string): Promise<ParsedKnowledge> {
    const systemPrompt = `
You are a highly secure Knowledge Extraction AI for an enterprise system.
Your tasks are:
1. STRICT REDACTION: You MUST explicitly identify and replace any passwords, API keys, access tokens, or obvious secrets with the exact string "[REDACTED]". This is an absolute priority. Do not store or reflect the secrets.
2. CATEGORIZATION: Map the input to one of the following categories: 'commercial', 'technical', 'quirks', 'other'.
3. STRUCTURING: Generate a concise title, format the redacted text into a readable structured 'content' string, and extract 2-5 relevant 'tags'.

Output MUST be valid JSON matching this schema exactly:
{
  "title": "Short descriptive title",
  "category": "commercial|technical|quirks|other",
  "content": "The fully redacted and structured knowledge...",
  "tags": ["tag1", "tag2"]
}
`;

    try {
        const response = await client.chat.completions.create({
            model: deploymentId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: rawText }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2, // Low temperature for consistent JSON and redaction reliability
        });

        const result = response.choices[0]?.message?.content;
        if (!result) throw new Error('No content returned from GPT');

        return JSON.parse(result) as ParsedKnowledge;
    } catch (error) {
        console.error('GPT Extraction Error:', error);
        throw error;
    }
}
