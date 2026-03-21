import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { verifyAuth } from '@/lib/firebase/serverAuth';
import { OpenAI } from 'openai';

// Define the tools for Function Calling
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Searches the central knowledge base (meeting summaries, drafts, documents) for information.",
      parameters: {
        type: "object",
        properties: {
          search_query: {
            type: "string",
            description: "The targeted semantic search query to find documents (e.g., 'What happened in the last marketing meeting?')."
          }
        },
        required: ["search_query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_open_tasks",
      description: "Fetches open (pending or in progress) tasks/action items from the Task Board.",
      parameters: {
        type: "object",
        properties: {
          clientName: {
            type: "string",
            description: "Optional. Filter tasks by a specific client name."
          },
          assignee: {
            type: "string",
            description: "Optional. Filter tasks by a specific assignee name."
          }
        }
      }
    }
  }
];

export async function POST(req: Request) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Prepare system prompt for tool calling
    const systemInstruction = {
        role: 'system',
        content: `You are the official PavelKnox AI knowledge assistant. 
Your primary goal is to answer the user's question accurately by using the provided tools.
- Use 'search_knowledge_base' to answer questions about meetings, documents, context, or summaries.
- Use 'get_open_tasks' ONLY when the user asks about tasks, action items, or things they need to do.

CRITICAL RULES FOR FINAL ANSWER:
1. STRICT KNOWLEDGE BINDING: If the answer is NOT strictly contained within the tool results, you MUST say "I don't know based on the provided data." DO NOT hallucinate.
2. EXTREMELY CLEAR FORMATTING: Use Markdown headings (\`### [Client/Topic]\`), **bold text**, bullet points, and tables. 
3. PRECISE CITATIONS: When using 'search_knowledge_base', you will receive a list of sources. You MUST explicitly cite ONLY the exact source URLs that you actually used to form your answer. Format citations as Markdown links at the end of the sentence or block: \`[Source Title](/knowledge/1234abc)\`. Do not cite sources you did not use.`
    };

    const messages = [systemInstruction, ...history, { role: 'user', content: query }];

    // 1st LLM Call: Let AI decide which tool to use
    let response = await ai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.1,
    });

    const responseMessage = response.choices[0].message;
    messages.push(responseMessage as any);

    let finalAnswer = "";
    let utilizedSources: any[] = [];
    let contextUsed = 0;

    // Check if AI wanted to call a function
    if (responseMessage.tool_calls) {
        for (const toolCall of responseMessage.tool_calls) {
            const functionName = (toolCall as any).function.name;
            const functionArgs = JSON.parse((toolCall as any).function.arguments);
            let functionResult = "";

            if (functionName === "search_knowledge_base") {
                const searchQuery = functionArgs.search_query || query;
                const queryEmbedding = await generateEmbedding(searchQuery);
                const coll = adminDb.collection("knowledge_chunks");
                const snapshot = await coll.findNearest('embedding', FieldValue.vector(queryEmbedding), {
                    limit: 10,
                    distanceMeasure: 'COSINE'
                }).get();

                const matchedDocs = snapshot.docs.map((doc: any) => doc.data());
                utilizedSources = matchedDocs.map((doc: any) => ({ title: doc.title || 'Untitled', url: doc.sourceUrl || '#', id: doc.sourceId || doc.sourceUrl }));
                
                functionResult = matchedDocs.map((doc: any, idx: number) => 
                    `[Source URL: ${doc.sourceUrl || '#'}] | Title: ${doc.title || 'Unknown'}\nContent: ${doc.content}`
                ).join('\n\n');
                
                contextUsed += matchedDocs.length;
            } 
            else if (functionName === "get_open_tasks") {
                let tasksRef: any = adminDb.collection("tasks").where('status', 'in', ['pending', 'in_progress']);
                if (functionArgs.clientName) {
                    tasksRef = tasksRef.where('clientName', '==', functionArgs.clientName);
                }
                if (functionArgs.assignee) {
                    tasksRef = tasksRef.where('assignee', '==', functionArgs.assignee);
                }
                
                const tasksSnapshot = await tasksRef.get();
                const matchedTasks = tasksSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                
                if (matchedTasks.length === 0) {
                    functionResult = "No open tasks found matching the criteria.";
                } else {
                    functionResult = JSON.stringify(matchedTasks.map((t: any) => ({
                        id: t.id,
                        description: t.description,
                        client: t.clientName,
                        assignee: t.assignee,
                        deadline: t.deadline,
                        source: t.sourceUrl || `/drafts/${t.sourceId}`
                    })), null, 2);
                    contextUsed += matchedTasks.length;
                    
                    matchedTasks.forEach((t: any) => {
                        utilizedSources.push({
                            title: `Task: ${t.description?.substring(0, 30)}...`,
                            url: t.sourceUrl || `/drafts/${t.sourceId}`
                        });
                    });
                }
            }

            // Append the tool result to messages
            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content: functionResult || "No results found."
            });
        }

        // 2nd LLM Call: Generate final answer based on tool outputs
        const finalResponse = await ai.chat.completions.create({
            model: "gpt-4o",
            messages: messages as any,
            temperature: 0.1,
        });

        finalAnswer = finalResponse.choices[0].message.content || "";
    } else {
        // AI didn't use a tool, meaning it answered directly (or declined)
        finalAnswer = responseMessage.content || "";
    }

    // Filter utilizedSources to only那些 actually mentioned in the final Answer text
    // (A rough but effective heuristic for precise citations)
    let filteredSources = utilizedSources;
    if (utilizedSources.length > 0) {
        filteredSources = utilizedSources.filter(source => {
            // Check if URL is in the text, or if the Title is exactly in the text
            return finalAnswer.includes(source.url) || finalAnswer.includes(`(${source.url})`);
        });
        
        // Fallback: if it stripped URLs, use the ones returned by vector search
        if (filteredSources.length === 0) {
             // Let's assume the AI cited all provided.
             filteredSources = utilizedSources;
        }
    }

    // Deduplicate sources by URL
    const uniqueSourcesObj: Record<string, any> = {};
    for (const src of filteredSources) {
        if (src.url) uniqueSourcesObj[src.url] = src;
    }
    const finalSourcesList = Object.values(uniqueSourcesObj);

    return NextResponse.json({ 
      success: true, 
      answer: finalAnswer,
      contextUsed,
      sources: finalSourcesList
    });

  } catch (error: any) {
    console.log('RAG API Error Message:', error?.message || String(error));
    
    const errorMsg = error?.message || '';
    if (errorMsg.includes('index') && errorMsg.includes('https://console.firebase.google.com')) {
        const urlMatch = errorMsg.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        const indexUrl = urlMatch ? urlMatch[0] : '';
        
        return NextResponse.json({ 
          error: `החיפוש דורש יצירת אינדקס וקטורי במסד הנתונים. אנא העתק את הלינק הבא והדבק בדפדפן כדי ליצור אותו: ${indexUrl}`
        }, { status: 500 });
    }

    return NextResponse.json({ error: errorMsg || 'Failed to generate answer' }, { status: 500 });
  }
}
