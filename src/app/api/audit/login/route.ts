import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/firebase/serverAuth';

export async function POST(request: Request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { adminDb } = await import('@/lib/firebase/admin');
    
    // Log login to audit
    await adminDb.collection('audit_logs').add({
      action: 'LOGIN',
      entityType: 'auth',
      entityId: auth.uid,
      targetEmail: auth.email || '',
      userId: auth.uid,
      userEmail: auth.email || 'unknown',
      details: `User logged in`,
      metadata: {
        source: 'email',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
        userAgent: request.headers.get('user-agent') || ''
      },
      createdAt: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error logging login action:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
