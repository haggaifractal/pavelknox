import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateEmbedding } from '@/lib/ai/embeddings';

// We import the OpenAI SDK for LLM generation 
import { OpenAI } from 'openai';

export async function POST(req: Request) {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '') || '';
    const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4o';
    
    const ai = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${endpoint}/openai/deployments/${deployment}`, 
      defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION! },
      defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY! },
    });

    const { query, history = [] } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // 1. Embed the user's query
    const queryEmbedding = await generateEmbedding(query);

    // 2. Perform Vector Search on Firestore
    const coll = adminDb.collection("knowledge_chunks");
    const snapshot = await coll.findNearest('embedding', FieldValue.vector(queryEmbedding), {
      limit: 10,
      distanceMeasure: 'COSINE'
    }).get();

    // Note: If you have not created a Vector Index in Firebase Console, this query will throw an error with a direct link to create the index!
    
    // 3. Extract the text chunks and format the contextual injection
    const matchedDocs = snapshot.docs.map((doc: any) => doc.data());
    const contextText = matchedDocs.map((doc: any, idx: number) => `[Source ${idx + 1} (${doc.title}) | URL: ${doc.sourceUrl || '#'}]:\n${doc.content}`).join('\n\n');

    // 4. Construct the prompt for the LLM
    const systemPrompt = `You are the official PavelKnox AI knowledge assistant. 
Your goal is to answer the user's question accurately, ONLY using the Provided Context below.

CRITICAL RULES:
1. STRICT KNOWLEDGE BINDING: If the answer is NOT strictly contained within the Provided Context, you MUST say "I don't know based on the provided knowledge base." DO NOT hallucinate external knowledge.
2. SYNTHESIS & AGGREGATION: If there are multiple sources discussing the topic, you MUST aggregate and merge the information from ALL relevant sources into a single comprehensive answer. Do not stop at the first source you find.
3. EXTREMELY CLEAR FORMATTING: You must structure the information so it is exceptionally easy to read. 
   - Use Markdown headings (e.g. \`### [Client/Source Name]\`) to clearly separate different clients, projects, or meetings.
   - Use **bold text** for key numbers, names, or pricing.
   - Use bullet points heavily.
   - If comparing data or listing similar items (like computer specs), use Markdown tables when appropriate.
4. CITATION & LINKS: Always explicitly cite the source titles. You MUST make the source title a clickable Markdown link pointing to its URL (e.g. \`[Source Title](/knowledge/1234abc)\`). Do not just output plain text for the source if a URL is provided.


--- PROVIDED CONTEXT ---
${contextText}
------------------------
`;

    // 5. Call LLM
    const response = await ai.chat.completions.create({
      model: "gpt-4o", // For Azure this is ignored, deployment name in baseURL handles it
      messages: [
        { role: 'system', content: systemPrompt },
        ...history, // optional conversational history you can pass from frontend
        { role: 'user', content: query }
      ],
      temperature: 0.1, // Low temp because we want factual RAG responses
    });

    const answer = response.choices[0].message.content;

    return NextResponse.json({ 
      success: true, 
      answer,
      contextUsed: matchedDocs.length,
      // We can also send the raw sources back so the UI can display "Citations"
      sources: matchedDocs.map((doc: any) => ({ title: doc.title, url: doc.sourceUrl }))
    });

  } catch (error: any) {
    // Log only the message string to prevent Next.js Dev Overlay from crashing 
    // when attempting to serialize complex Firebase gRPC error objects.
    console.log('RAG API Error Message:', error?.message || String(error));
    
    // Check if it's an indexing error (Firebase returns a specific error link for vector indexes)
    const errorMsg = error?.message || '';
    if (errorMsg.includes('index') && errorMsg.includes('https://console.firebase.google.com')) {
        // Extract the URL from the error message for the user
        const urlMatch = errorMsg.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        const indexUrl = urlMatch ? urlMatch[0] : '';
        
        return NextResponse.json({ 
          error: `החיפוש דורש יצירת אינדקס וקטורי במסד הנתונים. אנא העתק את הלינק הבא והדבק בדפדפן כדי ליצור אותו: ${indexUrl}`
        }, { status: 500 });
    }

    return NextResponse.json({ error: errorMsg || 'Failed to generate answer' }, { status: 500 });
  }
}
