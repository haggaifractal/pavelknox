import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifySuperAdmin } from '@/lib/firebase/serverAuth';

export async function PATCH(request: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await context.params;
    const uid = resolvedParams.uid;
    const body = await request.json();
    const { role, departmentIds, telegramChatId } = body;

    // Get current claims to preserve existing role if only departments changed, or vice versa
    const userRecord = await adminAuth.getUser(uid);
    const existingClaims = userRecord.customClaims || {};

    const newRole = role !== undefined ? role : existingClaims.role;
    const newDepartmentIds = departmentIds !== undefined ? departmentIds : (existingClaims.departmentIds || []);

    if (!newRole) {
      return NextResponse.json({ error: 'Missing role' }, { status: 400 });
    }

    // Set new custom claim
    await adminAuth.setCustomUserClaims(uid, { 
      ...existingClaims,
      role: newRole, 
      departmentIds: newDepartmentIds 
    });

    // Revoke refresh tokens immediately to force the user to get a new token with updated claims
    // or log them out if demoted.
    await adminAuth.revokeRefreshTokens(uid);

    // Update Firestore info if provided
    if (telegramChatId !== undefined) {
      const { adminDb } = await import('@/lib/firebase/admin');
      await adminDb.collection('users').doc(uid).set({
        telegramChatId: telegramChatId
      }, { merge: true });
    }

    return NextResponse.json({ success: true, message: 'User updated and sessions revoked' });
  } catch (err: any) {
    console.error('Error updating user role:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await context.params;
    const uid = resolvedParams.uid;

    if (auth.uid === uid) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);
    const { adminDb } = await import('@/lib/firebase/admin');
    await adminDb.collection('users').doc(uid).delete().catch(console.error);

    return NextResponse.json({ success: true, message: 'User deleted' });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
