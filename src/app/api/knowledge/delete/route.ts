import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // 1. Delete from knowledge_base
    await adminDb.collection('knowledge_base').doc(id).delete();

    // 2. Delete all existing chunks for this knowledge document
    // In our ingestion, sourceUrl is set to `/knowledge/${id}`
    const expectedSourceUrl = `/knowledge/${id}`;
    
    // Fallback: we might also want to query by something else if sourceUrl wasn't set perfectly, 
    // but sourceUrl is the most reliable link right now.
    const chunksSnapshot = await adminDb.collection('knowledge_chunks')
      .where('sourceUrl', '==', expectedSourceUrl)
      .get();
      
    // Create a batch delete
    if (!chunksSnapshot.empty) {
      const batch = adminDb.batch();
      chunksSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted document and ${chunksSnapshot.size} associated chunks.`
    });

  } catch (error: any) {
    console.error('Delete Knowledge Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete knowledge' }, { status: 500 });
  }
}
