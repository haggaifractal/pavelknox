import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifySuperAdmin } from '@/lib/firebase/serverAuth';

export async function POST(request: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await context.params;
    const uid = resolvedParams.uid;

    const userRecord = await adminAuth.getUser(uid);
    if (!userRecord || !userRecord.email) {
      return NextResponse.json({ error: 'User not found or has no email' }, { status: 404 });
    }

    // Generate password reset link so the user can actually log in
    // FIX: Using request.headers.get('origin') because on Firebase Hosting/Cloud Run
    // request.url will evaluate to the internal Cloud Run generic worker URL 
    const reqOrigin = request.headers.get('origin') || 
                      (request.headers.get('referer') ? new URL(request.headers.get('referer') as string).origin : null) || 
                      new URL(request.url).origin;
                      
    let resetLink;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(userRecord.email, {
        url: `${reqOrigin}/login`
      });
    } catch (resetError: any) {
      console.error(`[AUTH DEBUG] Failed to generate reset link for domain '${reqOrigin}'. Error:`, resetError);
      return NextResponse.json({ 
        error: `Domain '${reqOrigin}' is not allowlisted in Firebase Auth.`, 
        details: resetError.message 
      }, { status: 400 });
    }

    // Audit Log Generation
    const { adminDb } = await import('@/lib/firebase/admin');
    await adminDb.collection('audit_logs').add({
      action: 'GENERATE_RESET_LINK',
      entityType: 'user',
      entityId: uid,
      targetEmail: userRecord.email,
      userId: auth.uid,
      userEmail: auth.email || 'system',
      details: `Generated password reset link for user ${userRecord.email}`,
      metadata: {},
      createdAt: new Date()
    });

    return NextResponse.json({ success: true, resetLink });
  } catch (err: any) {
    console.error('Error generating reset link:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
