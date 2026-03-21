import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifySuperAdmin } from '@/lib/firebase/serverAuth';

export async function POST(request: Request) {
    try {
        const auth = await verifySuperAdmin(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        const { collectionsToClean, olderThanDays } = body;

        let deletedCount = 0;
        let details: Record<string, number> = {};

        if (collectionsToClean && olderThanDays) {
            if (!Array.isArray(collectionsToClean)) {
                return NextResponse.json({ error: 'collectionsToClean must be an array' }, { status: 400 });
            }

            const days = parseInt(olderThanDays);
            if (isNaN(days)) {
                return NextResponse.json({ error: 'olderThanDays must be a valid number' }, { status: 400 });
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            // Convert to Firebase admin Timestamp for reliable comparison
            const timestamp = Timestamp.fromDate(cutoffDate);

            if (collectionsToClean.includes('raw_inputs')) {
                const rawInputsRef = adminDb.collection('raw_inputs');
                
                const querySnapshot = await rawInputsRef
                    .where('createdAt', '<', timestamp)
                    .get();

                if (!querySnapshot.empty) {
                    const chunks = [];
                    let currentBatch = adminDb.batch();
                    let currentBatchCount = 0;
                    let count = 0;

                    querySnapshot.forEach((doc: any) => {
                        currentBatch.delete(doc.ref);
                        currentBatchCount++;
                        count++;

                        if (currentBatchCount === 500) {
                            chunks.push(currentBatch.commit());
                            currentBatch = adminDb.batch();
                            currentBatchCount = 0;
                        }
                    });

                    if (currentBatchCount > 0) {
                        chunks.push(currentBatch.commit());
                    }

                    await Promise.all(chunks);

                    deletedCount += count;
                    details['raw_inputs'] = count;
                } else {
                    details['raw_inputs'] = 0;
                }
            }
        }

        // --- Audit Log ---
        await adminDb.collection('audit_logs').add({
            action: 'BULK_CLEANUP',
            entityType: 'system',
            entityId: 'database',
            performedBy: auth.email || 'superadmin',
            details: {
                collections: collectionsToClean,
                olderThanDays: olderThanDays,
                deletedCount,
                breakdown: details
            },
            timestamp: FieldValue.serverTimestamp()
        });

        return NextResponse.json({ 
            success: true, 
            message: `Cleanup completed. Deleted ${deletedCount} records.`,
            details 
        });
    } catch (error: any) {
        console.error('API /admin/cleanup error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
