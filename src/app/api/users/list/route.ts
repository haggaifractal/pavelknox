import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/serverAuth';

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const listUsersResult = await adminAuth.listUsers(1000);
    const users = listUsersResult.users.map(u => ({
      uid: u.uid,
      displayName: u.displayName || u.email?.split('@')[0] || 'Unknown User',
    }));
    
    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('Error listing safe users:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
