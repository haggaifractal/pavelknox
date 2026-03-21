import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdmin } from '@/lib/firebase/serverAuth';

export async function GET(req: Request) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const snapshot = await adminDb.collection('users').get();
        const users = snapshot.docs.map(doc => ({
            uid: doc.id,
            email: doc.data().email || '',
            displayName: doc.data().displayName || 'Unknown',
            tokensUsedThisMonth: doc.data().tokensUsedThisMonth || 0,
            monthlyTokenLimit: doc.data().monthlyTokenLimit !== undefined ? doc.data().monthlyTokenLimit : 50000,
            lifetimeTokensUsed: doc.data().lifetimeTokensUsed || 0,
            costUSD: doc.data().costUSD || 0,
            modelsUsed: doc.data().modelsUsed || [],
            departmentIds: doc.data().departmentIds || []
        }));

        // Fetch all departments to map IDs to names
        const deptSnapshot = await adminDb.collection('departments').get();
        const departments = deptSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));

        return NextResponse.json({ success: true, users, departments });
    } catch (error: any) {
        console.error('Failed to get users token data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { uid, newLimit } = body;

        if (!uid || typeof newLimit !== 'number') {
            return NextResponse.json({ error: 'Invalid config payload' }, { status: 400 });
        }

        await adminDb.collection('users').doc(uid).update({
            monthlyTokenLimit: newLimit
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to update token limit:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
