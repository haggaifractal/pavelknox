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
    const { firstName, lastName, phone, role, departmentIds, telegramChatId } = body;

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
    let previousTelegramId: string | undefined;
    let previousFirstName: string | undefined;
    let previousLastName: string | undefined;
    let previousPhone: string | undefined;
    const { adminDb } = await import('@/lib/firebase/admin');
    
    if (telegramChatId !== undefined || firstName !== undefined || lastName !== undefined || phone !== undefined) {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const data = userDoc.data() || {};
      previousTelegramId = data.telegramChatId;
      previousFirstName = data.firstName;
      previousLastName = data.lastName;
      previousPhone = data.phone;
      
      const updateData: any = {};
      if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phone !== undefined) updateData.phone = phone;

      // Update displayName if firstName or lastName change 
      if (firstName !== undefined || lastName !== undefined) {
         const newFirst = firstName !== undefined ? firstName : (previousFirstName || '');
         const newLast = lastName !== undefined ? lastName : (previousLastName || '');
         const newDisplayName = `${newFirst} ${newLast}`.trim();
         updateData.displayName = newDisplayName;
         // Also update Firebase Auth displayName
         await adminAuth.updateUser(uid, { displayName: newDisplayName }).catch(console.error);
      }
      
      await adminDb.collection('users').doc(uid).set(updateData, { merge: true });
    }

    // Audit Log Registration
    const changes: Record<string, any> = {};
    if (role !== undefined && role !== existingClaims.role) {
       changes.role = { from: existingClaims.role || 'viewer', to: role };
    }
    if (departmentIds !== undefined) {
       changes.departmentIds = { to: departmentIds }; // Can't easily display from/to arrays in UI compactly, just log 'to'
    }
    if (telegramChatId !== undefined && telegramChatId !== previousTelegramId) {
       changes.telegramChatId = { from: previousTelegramId || '', to: telegramChatId };
    }
    if (firstName !== undefined && firstName !== previousFirstName) {
       changes.firstName = { from: previousFirstName || '', to: firstName };
    }
    if (lastName !== undefined && lastName !== previousLastName) {
       changes.lastName = { from: previousLastName || '', to: lastName };
    }
    if (phone !== undefined && phone !== previousPhone) {
       changes.phone = { from: previousPhone || '', to: phone };
    }

    if (Object.keys(changes).length > 0) {
      await adminDb.collection('audit_logs').add({
        action: 'UPDATE_USER',
        entityType: 'user',
        entityId: uid,
        targetEmail: userRecord.email,
        userId: auth.uid,
        userEmail: auth.email || 'system',
        details: `Updated metadata for user ${userRecord.email}`,
        metadata: changes,
        createdAt: new Date()
      });
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
    const userDocRef = adminDb.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    const userEmail = await adminAuth.getUser(uid).then(u => u.email).catch(() => userDoc.data()?.email || 'unknown');
    
    await userDocRef.delete().catch(console.error);

    await adminDb.collection('audit_logs').add({
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: uid,
      targetEmail: userEmail,
      userId: auth.uid,
      userEmail: auth.email || 'system',
      details: `Deleted user ${userEmail}`,
      metadata: {},
      createdAt: new Date()
    }).catch(console.error);

    return NextResponse.json({ success: true, message: 'User deleted' });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
