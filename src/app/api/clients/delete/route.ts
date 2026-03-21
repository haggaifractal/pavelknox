import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdmin } from '@/lib/firebase/serverAuth';
import { createAuditLog } from '@/lib/services/audit';

export async function POST(req: Request) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, name } = body;

        if (!id) {
            return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
        }

        // Delete from clients collection
        await adminDb.collection('clients').doc(id).delete();

        // Write Audit Log
        await createAuditLog({
            actionType: 'DELETE_CLIENT',
            userId: auth.uid,
            userEmail: auth.email || 'unknown',
            targetId: id,
            details: { name: name || 'Unknown' }
        });

        return NextResponse.json({ success: true, message: 'Client deleted successfully.' });

    } catch (error: any) {
        console.error('Delete Client Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete client' }, { status: 500 });
    }
}
