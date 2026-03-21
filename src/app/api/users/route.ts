import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifySuperAdmin } from '@/lib/firebase/serverAuth';

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const listUsersResult = await adminAuth.listUsers(1000);
    const firestoreUsersSnapshot = await (await import('@/lib/firebase/admin')).adminDb.collection('users').get();
    const firestoreData = new Map(firestoreUsersSnapshot.docs.map(doc => [doc.id, doc.data()]));

    const users = listUsersResult.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      role: u.customClaims?.role || 'viewer',
      departmentIds: u.customClaims?.departmentIds || [],
      lastLoginAt: u.metadata.lastSignInTime,
      creationTime: u.metadata.creationTime,
      telegramChatId: firestoreData.get(u.uid)?.telegramChatId || '',
    }));
    
    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('Error listing users:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { email, displayName, role, departmentIds, telegramChatId } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate random strong password
    const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + '!A1';

    // Create user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });

    // Set custom claim
    await adminAuth.setCustomUserClaims(userRecord.uid, { 
      role, 
      departmentIds: departmentIds || [] 
    });

    // Save to Firestore
    const { adminDb } = await import('@/lib/firebase/admin');
    await adminDb.collection('users').doc(userRecord.uid).set({
      email: userRecord.email, // Sync basic info
      displayName: userRecord.displayName || email.split('@')[0],
      telegramChatId: telegramChatId || '',
      monthlyTokenLimit: 5000000,
      tokensUsedThisMonth: 0,
      lifetimeTokensUsed: 0,
    }, { merge: true });

    // Generate password reset link so the user can actually log in
    const origin = new URL(request.url).origin;
    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${origin}/login`
    });

    return NextResponse.json({ 
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: role,
        departmentIds: departmentIds || [],
        telegramChatId: telegramChatId || ''
      },
      resetLink 
    });

  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
