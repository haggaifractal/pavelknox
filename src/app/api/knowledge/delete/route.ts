import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdmin } from '@/lib/firebase/serverAuth';

export async function POST(req: Request) {
  try {
    const auth = await verifyAdmin(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // 3. Delete all associated tasks
    const tasksSnapshot = await adminDb.collection('tasks').where('sourceId', '==', id).get();
    let deletedTasksCount = 0;
    if (!tasksSnapshot.empty) {
      const batch = adminDb.batch();
      tasksSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      deletedTasksCount = tasksSnapshot.size;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted document, ${chunksSnapshot?.size || 0} chunks, and ${deletedTasksCount} tasks.`
    });

  } catch (error: any) {
    console.error('Delete Knowledge Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete knowledge' }, { status: 500 });
  }
}
