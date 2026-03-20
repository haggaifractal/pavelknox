import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateEmbeddingsBatch } from '@/lib/ai/embeddings';
import { chunkText } from '@/lib/utils/chunking';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, type = 'article', sourceUrl = '', clientName = '', tags = [] } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // 1. Chunk the document
    const chunks = chunkText(content);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Content is too short or empty' }, { status: 400 });
    }

    // 1.5 Inject metadata into chunks for better semantic retrieval
    const enrichedChunks = chunks.map(chunk => {
      let prefix = `Document Title: ${title}\n`;
      if (clientName) prefix += `Client: ${clientName}\n`;
      if (tags && tags.length > 0) prefix += `Tags: ${tags.join(', ')}\n`;
      return `${prefix}\nContent:\n${chunk}`;
    });

    // 2. Generate Embeddings for all chunks using the enriched text
    const embeddings = await generateEmbeddingsBatch(enrichedChunks);

    // 3. Save to Firestore `knowledge_chunks` collection
    // Create a batch
    const batch = adminDb.batch();
    const collectionRef = adminDb.collection('knowledge_chunks');
    const sourceId = crypto.randomUUID(); // Unique ID representing the parent document

    chunks.forEach((chunkText, index) => {
      const docRef = collectionRef.doc(); // Auto-generate ID for the chunk
      batch.set(docRef, {
        sourceId,
        title,
        type,
        clientName,
        tags,
        sourceUrl,
        content: chunkText, // Keep the original text for the UI, but the vector represents the enriched text
        // In Firestore, vectors are saved via FieldValue.vector
        embedding: FieldValue.vector(embeddings[index]),
        chunkIndex: index,
        totalChunks: chunks.length,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: `Successfully ingested ${chunks.length} chunks.`,
      sourceId 
    });

  } catch (error: any) {
    console.error('Ingestion Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to ingest knowledge' }, { status: 500 });
  }
}
