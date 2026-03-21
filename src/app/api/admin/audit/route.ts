import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdmin } from '@/lib/firebase/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch logs from Firestore, ordered by timestamp descending
        const snapshot = await adminDb.collection('audit_logs')
            .orderBy('timestamp', 'desc')
            .limit(200)
            .get();

        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
        }));

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        console.error('Failed to get audit logs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
