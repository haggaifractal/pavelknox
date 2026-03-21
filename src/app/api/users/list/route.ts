import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/serverAuth';

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch registered users
    const listUsersResult = await adminAuth.listUsers(1000);
    const users = listUsersResult.users.map(u => ({
      uid: u.uid,
      displayName: u.displayName || u.email?.split('@')[0] || 'Unknown User',
    }));
    
    // Fetch custom assignees from tasks
    const tasksSnapshot = await adminDb.collection('tasks').select('assignee').get();
    const existingNames = new Set(users.map(u => u.displayName.toLowerCase()));
    
    tasksSnapshot.forEach(doc => {
      const assignee = doc.data().assignee;
      if (assignee && typeof assignee === 'string') {
        const trimmed = assignee.trim();
        if (trimmed && !existingNames.has(trimmed.toLowerCase())) {
          existingNames.add(trimmed.toLowerCase());
          users.push({
            uid: `custom-${Buffer.from(trimmed).toString('base64').substring(0, 10)}`,
            displayName: trimmed
          });
        }
      }
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('Error listing safe users:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
