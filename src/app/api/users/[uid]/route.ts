import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifySuperAdmin } from '@/lib/firebase/serverAuth';

export async function PATCH(request: Request, context: { params: Promise<{ uid: string }> | { uid: string } }) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await context.params;
    const uid = resolvedParams.uid;
    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json({ error: 'Missing role' }, { status: 400 });
    }

    // Set new custom claim
    await adminAuth.setCustomUserClaims(uid, { role });

    // Revoke refresh tokens immediately to force the user to get a new token with updated claims
    // or log them out if demoted.
    await adminAuth.revokeRefreshTokens(uid);

    return NextResponse.json({ success: true, message: 'Role updated and sessions revoked' });
  } catch (err: any) {
    console.error('Error updating user role:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ uid: string }> | { uid: string } }) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await context.params;
    const uid = resolvedParams.uid;

    if (auth.uid === uid) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true, message: 'User deleted' });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
