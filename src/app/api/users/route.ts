import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifySuperAdmin } from '@/lib/firebase/serverAuth';

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const listUsersResult = await adminAuth.listUsers(1000);
    const users = listUsersResult.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      role: u.customClaims?.role || 'viewer',
      lastLoginAt: u.metadata.lastSignInTime,
      creationTime: u.metadata.creationTime,
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
    const { email, displayName, role } = body;

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
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

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
        role: role
      },
      resetLink 
    });

  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
