import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/serverAuth';

export async function POST(request: Request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { displayName } = await request.json();
    if (!displayName) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    }

    // Check if any tasks are assigned to this custom user
    const tasksSnapshot = await adminDb.collection('tasks').where('assignee', '==', displayName).get();
    
    if (!tasksSnapshot.empty) {
      return NextResponse.json({ 
        error: `אי אפשר למחוק את "${displayName}": יש ${tasksSnapshot.size} משימות משויכות. יש להעביר או למחוק אותן קודם.`,
        inUse: true,
        count: tasksSnapshot.size
      }, { status: 400 });
    }

    // Since custom assignees are generated from tasks, if there are 0 tasks, 
    // it inherently doesn't exist anymore. We just return success.
    return NextResponse.json({ success: true });
    
  } catch (err: any) {
    console.error('Error deleting custom user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
