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
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }

        const taskDoc = await adminDb.collection('tasks').doc(id).get();
        if (!taskDoc.exists) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const taskData = taskDoc.data();

        await adminDb.collection('tasks').doc(id).update({ isDeleted: true, deletedAt: new Date() });

        await createAuditLog({
            actionType: 'DELETE_TASK',
            userId: auth.uid,
            userEmail: auth.email || 'unknown',
            targetId: id,
            details: {
                title: taskData?.title || 'Untitled Task',
                originalKnowledgeId: taskData?.sourceKnowledgeId || null
            }
        });

        return NextResponse.json({ success: true, message: 'Successfully deleted task.' });

    } catch (error: any) {
        console.error('Delete Task Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete task' }, { status: 500 });
    }
}
