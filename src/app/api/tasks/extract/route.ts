import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/firebase/serverAuth';
import { AzureOpenAI } from 'openai';

delete process.env.AZURE_OPENAI_BASE_URL;
delete process.env.OPENAI_BASE_URL;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'dummy_key_for_build',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://dummy.openai.azure.com',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
});

const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID || 'gpt-4o';

export async function POST(req: Request) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { content, metadata } = body;

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        const systemPrompt = `
You are an expert AI assistant tasked with extracting actionable tasks and deadlines from organizational documents and summaries.
The output values MUST be in Hebrew (except for JSON keys).
You will receive the document text along with some metadata context.
Extract a list of actionable tasks. If there are no clear tasks, return an empty array.

DOCUMENT METADATA:
- Current Date for relative deadline calculations: ${metadata?.currentDate || new Date().toISOString()}
- Client Name: ${metadata?.clientName || 'Unknown'}
- Project Name: ${metadata?.projectName || 'Unknown'}
- Document Title: ${metadata?.title || 'Unknown'}

EXTRACTION RULES:
1. "description": A clear, concise description of the action item in Hebrew.
2. "assignee": The name of the person responsible in Hebrew. If not specified, return null.
3. "deadline": Extract any mentioned deadline. Convert relative dates (e.g., "next week", "מחר", "עוד יומיים") to an absolute ISO 8601 date string (YYYY-MM-DDTHH:mm:ss.sssZ) using the Current Date provided above as the anchor. If no deadline is mentioned, return null.

You MUST return a valid JSON object matching this exact schema:
{
  "tasks": [
    {
      "description": "string",
      "assignee": "string | null",
      "deadline": "string | null"
    }
  ]
}
`;

        const response = await client.chat.completions.create({
            model: deploymentId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: content }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
        });

        const resultText = response.choices[0]?.message?.content;
        if (!resultText) {
            throw new Error('No content returned from AI');
        }

        const parsed = JSON.parse(resultText);
        
        return NextResponse.json({ tasks: parsed.tasks || [] });

    } catch (error: any) {
        console.error('Task Extraction API Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to extract tasks' }, { status: 500 });
    }
}
