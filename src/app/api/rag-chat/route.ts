import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { verifyAuth } from '@/lib/firebase/serverAuth';
import { OpenAI, AzureOpenAI } from 'openai';

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
      description: "Fetches open (pending or in progress) tasks/action items from the Task Board. Supports partial or fuzzy matching.",
      parameters: {
        type: "object",
        properties: {
          clientName: {
            type: "string",
            description: "Optional. Filter tasks by a specific client name. You can use partial names."
          },
          assignee: {
            type: "string",
            description: "Optional. Filter tasks by a specific assignee name. You can use partial names."
          }
        }
      }
    }
  }
];

export async function POST(req: Request) {
  let debugStep = 'init';
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch User Quota Data
    const userDocRef = adminDb.collection('users').doc(auth.uid);
    const userDoc = await userDocRef.get();
    const userData = userDoc.data() || {};
    
    // Default config fallback: 50,000 tokens
    const tokensUsedThisMonth = userData.tokensUsedThisMonth || 0;
    const monthlyTokenLimit = userData.monthlyTokenLimit !== undefined ? userData.monthlyTokenLimit : 50000;

    if (tokensUsedThisMonth >= monthlyTokenLimit) {
        return NextResponse.json({ 
            success: false, 
            error: 'הגעת למכסת ה-AI החודשית שלך. אנא פנה למנהל המערכת להגדלת המכסה.',
            limitReached: true 
        }, { status: 403 });
    }

    debugStep = 'azure_init';
    const ai = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
      deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4o',
    });

    let query, history;
    try {
        debugStep = 'parse_body';
        const body = await req.json();
        query = body.query;
        history = body.history || [];
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Fetch Entity Dictionary for RAG Context
    const [usersSnap, clientsSnap] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('clients').get()
    ]);
    const knownAssignees = usersSnap.docs.map(d => d.data().displayName || d.data().name).filter(Boolean).join(', ');
    const knownClients = clientsSnap.docs.map(d => d.data().name).filter(Boolean).join(', ');

    // Prepare system prompt for tool calling
    const systemInstruction = {
        role: 'system',
        content: `You are the official PavelKnox AI knowledge assistant. 
Your primary goal is to answer the user's question accurately by using the provided tools.
- Use 'search_knowledge_base' to answer questions about meetings, documents, context, or summaries.
- Use 'get_open_tasks' ONLY when the user asks about tasks, action items, or things they need to do.

SYSTEM CONTEXT (Entity Dictionary):
- Known Assignees/Staff: ${knownAssignees || 'None yet'}
- Known Clients: ${knownClients || 'None yet'}
When a user asks about a partial name (e.g., "חגי"), use this dictionary to resolve it to the full name (e.g., "חגי יחיאל") BEFORE calling tools.

CRITICAL RULES FOR FINAL ANSWER:
0. THE GATEKEEPER RULE (PRE-SEARCH): If the user asks for "everything", "all tasks", "all general info", or if their query is extremely broad without specifying a specific client, employee, or topic, YOU MUST REFUSE TO SEARCH. Do NOT call 'search_knowledge_base' or 'get_open_tasks'. Instead, politely ask them to be more specific (e.g., "I have a lot of data. Could you please specify a client or topic to help me narrow it down?").
1. STRICT KNOWLEDGE BINDING: If the answer is NOT strictly contained within the tool results, you MUST say "I don't know based on the provided data." DO NOT hallucinate.
2. EXTREMELY CLEAR FORMATTING: Use Markdown headings (\`### [Client/Topic]\`), **bold text**, bullet points, and tables. 
3. PRECISE CITATIONS: When using 'search_knowledge_base', you will receive a list of sources. You MUST explicitly cite ONLY the exact source URLs that you actually used to form your answer. Format citations as Markdown links at the end of the sentence or block: \`[Source Title](/knowledge/1234abc)\`. Do not cite sources you did not use.
4. OVERLOAD PROTECTION: If a tool returns a 'SYSTEM NOTICE' about truncated data (e.g. over 5 tasks), you MUST inform the user naturally, summarize the few you received, and ask them to refine their search (e.g., 'To see the rest, please specify a client or assignee'). Do NOT invent the missing data.`
    };

    const messages = [systemInstruction, ...history, { role: 'user', content: query }];

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    debugStep = 'llm_call_1';
    // 1st LLM Call: Let AI decide which tool to use
    let response = await ai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.1,
    });

    if (response.usage) {
        totalPromptTokens += response.usage.prompt_tokens;
        totalCompletionTokens += response.usage.completion_tokens;
    }

    const responseMessage = response.choices[0].message;
    messages.push(responseMessage as any);

    let finalAnswer = "";
    let utilizedSources: any[] = [];
    let contextUsed = 0;

    // Check if AI wanted to call a function
    if (responseMessage.tool_calls) {
        debugStep = 'process_tools';
        for (const toolCall of responseMessage.tool_calls) {
            const functionName = (toolCall as any).function.name;
            const functionArgs = JSON.parse((toolCall as any).function.arguments || '{}');
            let functionResult = "";

            if (functionName === "search_knowledge_base") {
                const searchQuery = functionArgs.search_query || query;
                const queryEmbedding = await generateEmbedding(searchQuery);
                const coll = adminDb.collection("knowledge_chunks");
                const snapshot = await coll.findNearest('embedding', FieldValue.vector(queryEmbedding), {
                    limit: 5,
                    distanceMeasure: 'COSINE'
                }).get();

                const matchedDocs = snapshot.docs.map((doc: any) => doc.data());
                utilizedSources = matchedDocs.map((doc: any) => ({ title: doc.title || 'Untitled', url: doc.sourceUrl || '#', id: doc.sourceId || doc.sourceUrl }));
                
                functionResult = matchedDocs.map((doc: any, idx: number) => 
                    `[Source URL: ${doc.sourceUrl || '#'}] | Title: ${doc.title || 'Unknown'}\nContent: ${doc.content}`
                ).join('\n\n');
                
                functionResult += `\n\n[SYSTEM NOTICE: Displaying the top 5 most relevant knowledge snippets to save context. If the user requires other specific info, ask them for a stronger keyword filter.]`;

                contextUsed += matchedDocs.length;
            } 
            else if (functionName === "get_open_tasks") {
                const tasksRef = adminDb.collection("tasks").where('status', 'in', ['pending', 'in_progress']);
                const tasksSnapshot = await tasksRef.get();
                let matchedTasks = tasksSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));

                // Perform fuzzy matching in memory
                if (functionArgs.clientName) {
                    const searchClient = String(functionArgs.clientName).toLowerCase();
                    matchedTasks = matchedTasks.filter((t: any) => 
                        t.clientName && t.clientName.toLowerCase().includes(searchClient)
                    );
                }
                if (functionArgs.assignee) {
                    const searchAssignee = String(functionArgs.assignee).toLowerCase();
                    matchedTasks = matchedTasks.filter((t: any) => 
                        t.assignee && t.assignee.toLowerCase().includes(searchAssignee)
                    );
                }
                
                if (matchedTasks.length === 0) {
                    functionResult = "No open tasks found matching the criteria.";
                } else {
                    const totalTasks = matchedTasks.length;
                    const slicedTasks = matchedTasks.slice(0, 5);

                    functionResult = JSON.stringify(slicedTasks.map((t: any) => ({
                        id: t.id,
                        description: t.description,
                        client: t.clientName,
                        assignee: t.assignee,
                        deadline: t.deadline,
                        source: t.sourceUrl || `/drafts/${t.sourceId}`
                    })), null, 2);

                    if (totalTasks > 5) {
                        functionResult += `\n\n[SYSTEM NOTICE: Found ${totalTasks} tasks but only providing the top 5 to save memory. The remaining ${totalTasks - 5} tasks are hidden. Explicitly ask the user to filter down by clientName or assignee to see the specific ones they need.]`;
                    }

                    contextUsed += slicedTasks.length;
                    
                    slicedTasks.forEach((t: any) => {
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

        debugStep = 'llm_call_2';
        // 2nd LLM Call: Generate final answer based on tool outputs
        const finalResponse = await ai.chat.completions.create({
            model: "gpt-4o",
            messages: messages as any,
            temperature: 0.1,
        });

        if (finalResponse.usage) {
            totalPromptTokens += finalResponse.usage.prompt_tokens;
            totalCompletionTokens += finalResponse.usage.completion_tokens;
        }

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

    const totalTokensUsed = totalPromptTokens + totalCompletionTokens;

    // Audit log and Quota Update
    const batch = adminDb.batch();
    
    debugStep = 'audit_quota_log';
    // Update user quota
    const modelName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4o';
    let currCostUSD = 0;
    if (modelName.toLowerCase().includes('mini')) {
        currCostUSD = (totalPromptTokens * 0.150 / 1000000) + (totalCompletionTokens * 0.600 / 1000000);
    } else {
        currCostUSD = (totalPromptTokens * 2.50 / 1000000) + (totalCompletionTokens * 10.00 / 1000000);
    }

    const quotaUpdateData: any = {
        tokensUsedThisMonth: FieldValue.increment(totalTokensUsed || 0),
        lifetimeTokensUsed: FieldValue.increment(totalTokensUsed || 0),
        costUSD: FieldValue.increment(currCostUSD),
        modelsUsed: FieldValue.arrayUnion(modelName),
        lastActivityDate: new Date()
    };
    if (auth.email) quotaUpdateData.email = auth.email;
    if (auth.name) quotaUpdateData.displayName = auth.name;

    batch.set(userDocRef, quotaUpdateData, { merge: true });

    // Add audit log
    const logRef = adminDb.collection('ai_chat_logs').doc();
    batch.set(logRef, {
        timestamp: new Date(),
        query: query,
        response: finalAnswer,
        source: 'Web',
        userId: auth.uid,
        contextUsed: contextUsed,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalTokensUsed
    });

    await batch.commit().catch(err => console.error('Failed to log chat and update quota:', err));

    return NextResponse.json({ 
      success: true, 
      answer: finalAnswer,
      contextUsed,
      sources: finalSourcesList
    });

  } catch (error: any) {
    console.log('RAG API Error Message:', error?.message || String(error));
    
    const errorMsg = `[Step: ${debugStep}] ${error?.message || ''}`;
    if (errorMsg.includes('index') && errorMsg.includes('https://console.firebase.google.com')) {
        const urlMatch = errorMsg.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        const indexUrl = urlMatch ? urlMatch[0] : '';
        
        return NextResponse.json({ 
          error: `Vector index required for search. Please copy this link and paste it into your browser to create the index: ${indexUrl}`,
          indexUrl
        }, { status: 500 });
    }

    return NextResponse.json({ error: errorMsg || 'Failed to generate answer' }, { status: 500 });
  }
}
