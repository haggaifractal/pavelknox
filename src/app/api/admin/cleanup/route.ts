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

        const body = await request.json();
        const { collectionsToClean, olderThanDays } = body;

        let deletedCount = 0;
        let details = {};

        if (collectionsToClean && olderThanDays) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));
            // Convert to Firebase admin Timestamp for reliable comparison
            const timestamp = Timestamp.fromDate(cutoffDate);

            if (collectionsToClean.includes('raw_inputs')) {
                const rawInputsRef = adminDb.collection('raw_inputs');
                
                const querySnapshot = await rawInputsRef
                    .where('createdAt', '<', timestamp)
                    .get();

                if (!querySnapshot.empty) {
                    const batch = adminDb.batch();
                    let count = 0;

                    querySnapshot.forEach((doc: any) => {
                        batch.delete(doc.ref);
                        count++;
                    });

                    await batch.commit();

                    deletedCount += count;
                    // @ts-ignore
                    details['raw_inputs'] = count;
                } else {
                    // @ts-ignore
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
