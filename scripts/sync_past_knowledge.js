// scripts/sync_past_knowledge.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function syncPastKnowledge() {
    console.log("Fetching existing knowledge base documents...");
    const kbDocs = await db.collection('knowledge_base').get();
    console.log(`Found ${kbDocs.size} documents in knowledge_base.`);

    let successCount = 0;
    let skipCount = 0;

    for (const docSnap of kbDocs.docs) {
        const id = docSnap.id;
        const data = docSnap.data();
        const sourceUrl = `/knowledge/${id}`;

        // Check if already ingested using the sourceUrl linkage
        const existingChunks = await db.collection('knowledge_chunks')
            .where('sourceUrl', '==', sourceUrl)
            .limit(1)
            .get();

        if (!existingChunks.empty) {
            console.log(`[SKIP] Document ${id} already vectorized.`);
            skipCount++;
            continue;
        }

        console.log(`[INGEST] Processing document ${id}: ${data.title}`);
        
        try {
            // Call the local Next.js API to process the text, chunk it, and embed it using the Azure OpenAI keys
            const res = await fetch('http://localhost:3000/api/knowledge/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: data.title || 'Untitled',
                    content: data.content || '',
                    type: 'legacy_approved_draft',
                    sourceUrl: sourceUrl
                })
            });

            if (!res.ok) {
                console.error(`Failed to ingest ${id}:`, await res.text());
            } else {
                console.log(`Successfully ingested ${id}`);
                successCount++;
            }
        } catch (e) {
            console.error(`Erroring processing ${id}:`, e.message);
        }
        
        // Sleep a bit to avoid rate limits on Azure OpenAI Embedding API
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`===========================`);
    console.log(`Sync complete!`);
    console.log(`Successfully Vectorized: ${successCount}`);
    console.log(`Skipped (Already Synced): ${skipCount}`);
}

syncPastKnowledge().catch(console.error);
