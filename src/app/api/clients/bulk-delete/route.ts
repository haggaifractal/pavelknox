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
        const { clientIds } = body;

        if (!Array.isArray(clientIds) || clientIds.length === 0) {
            return NextResponse.json({ error: 'Client IDs array is required' }, { status: 400 });
        }

        // We can process batches up to 500 documents per batch transaction
        const batchSize = 400;
        let deletedCount = 0;

        for (let i = 0; i < clientIds.length; i += batchSize) {
            const batchChunk = clientIds.slice(i, i + batchSize);
            const batch = adminDb.batch();

            for (const id of batchChunk) {
                const clientRef = adminDb.collection('clients').doc(id);
                batch.delete(clientRef);
                deletedCount++;
            }

            await batch.commit();
        }

        // Write Audit Log
        await createAuditLog({
            actionType: 'BULK_DELETE_CLIENTS',
            userId: auth.uid,
            userEmail: auth.email || 'unknown',
            targetId: 'multiple',
            details: { count: deletedCount, ids: clientIds }
        });

        return NextResponse.json({ success: true, message: `Successfully deleted ${deletedCount} clients.` });

    } catch (error: any) {
        console.error('Bulk Delete Client Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to bulk delete clients' }, { status: 500 });
    }
}
