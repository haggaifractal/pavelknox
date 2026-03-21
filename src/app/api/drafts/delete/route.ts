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
        const { id, transferToClientName } = body;

        if (!id) {
            return NextResponse.json({ error: 'Draft ID is required' }, { status: 400 });
        }

        // Fetch draft to get originalInputId
        const draftDoc = await adminDb.collection('drafts').doc(id).get();
        if (!draftDoc.exists) {
            return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
        }

        const draftData = draftDoc.data();
        let deletedRawInput = false;

        // Try deleting original raw input if it exists
        if (draftData?.originalInputId) {
            const rawRef = adminDb.collection('raw_inputs').doc(draftData.originalInputId);
            const rawDoc = await rawRef.get();
            if (rawDoc.exists) {
                await rawRef.delete();
                deletedRawInput = true;
            }
        }

        // Soft delete draft itself
        await adminDb.collection('drafts').doc(id).update({ isDeleted: true, deletedAt: new Date() });

        // Cascade delete associated tasks
        const tasksSnapshot = await adminDb.collection('tasks').where('sourceId', '==', id).get();
        let deletedTasksCount = 0;
        if (!tasksSnapshot.empty) {
            const batch = adminDb.batch();
            tasksSnapshot.docs.forEach(doc => {
                if (transferToClientName) {
                    batch.update(doc.ref, { 
                        clientName: transferToClientName, 
                        sourceId: null, 
                        sourceType: 'transferred' 
                    });
                } else {
                    batch.update(doc.ref, { isDeleted: true, deletedAt: new Date() });
                }
            });
            await batch.commit();
            deletedTasksCount = tasksSnapshot.size;
        }

        // Audit Log
        await createAuditLog({
            actionType: 'DELETE_DRAFT',
            userId: auth.uid,
            userEmail: auth.email || 'unknown',
            targetId: id,
            details: {
                deletedAssociatedRawInput: deletedRawInput,
                affectedTasksCount: deletedTasksCount,
                transferredTo: transferToClientName || null,
                originalInputId: draftData?.originalInputId || null,
                title: draftData?.title || draftData?.clientName || 'Untitled'
            }
        });

        return NextResponse.json({ 
            success: true, 
            message: `Successfully deleted draft${deletedRawInput ? ' and its original raw input.' : '.'}` 
        });

    } catch (error: any) {
        console.error('Delete Draft Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete draft' }, { status: 500 });
    }
}
