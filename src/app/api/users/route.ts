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
      firstName: firestoreData.get(u.uid)?.firstName || '',
      lastName: firestoreData.get(u.uid)?.lastName || '',
      phone: firestoreData.get(u.uid)?.phone || '',
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
    const { email, firstName, lastName, phone, role, departmentIds, telegramChatId } = body;

    if (!email || !role || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const displayName = `${firstName} ${lastName}`.trim();

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
      displayName: userRecord.displayName,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      telegramChatId: telegramChatId || '',
      monthlyTokenLimit: 5000000,
      tokensUsedThisMonth: 0,
      lifetimeTokensUsed: 0,
    }, { merge: true });

    // Generate password reset link so the user can actually log in
    // FIX: Using request.headers.get('origin') because on Firebase Hosting/Cloud Run
    // request.url will evaluate to the internal Cloud Run generic worker URL 
    // which is NOT in the allowed authentication domains.
    const reqOrigin = request.headers.get('origin') || 
                      (request.headers.get('referer') ? new URL(request.headers.get('referer') as string).origin : null) || 
                      new URL(request.url).origin;
                      
    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${reqOrigin}/login`
    });

    // We do this in the background/after the response preparation to not block the request
    await adminDb.collection('audit_logs').add({
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: userRecord.uid,
      targetEmail: userRecord.email,
      userId: auth!.uid,
      userEmail: auth!.email || 'system',
      details: `Created new user ${userRecord.email}`,
      metadata: { role, departmentIds },
      createdAt: new Date()
    }).catch(err => console.error('Failed to log audit:', err));

    return NextResponse.json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
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
