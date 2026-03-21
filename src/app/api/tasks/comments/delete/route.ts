import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/serverAuth';
import { createAuditLog } from '@/lib/services/audit';

export async function POST(req: Request) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { taskId, commentId } = body;

        if (!taskId || !commentId) {
            return NextResponse.json({ error: 'Task ID and Comment ID are required' }, { status: 400 });
        }

        const commentRef = adminDb.collection('tasks').doc(taskId).collection('comments').doc(commentId);
        const commentDoc = await commentRef.get();
        if (!commentDoc.exists) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        const commentData = commentDoc.data();

        // Check permissions: Only author or an admin/superadmin can delete
        const isAdmin = auth.role === 'admin' || auth.role === 'superadmin';
        const isAuthor = commentData?.authorId === auth.uid;

        if (!isAdmin && !isAuthor) {
            return NextResponse.json({ error: 'Forbidden. You do not have permission to delete this comment.' }, { status: 403 });
        }

        await commentRef.delete();

        // Audit Log
        await createAuditLog({
            actionType: 'DELETE_COMMENT',
            userId: auth.uid,
            userEmail: auth.email || 'unknown',
            targetId: taskId,
            details: {
                commentId,
                commentText: commentData?.text?.substring(0, 50) + '...' || '',
                originalAuthorId: commentData?.authorId || null,
            }
        });

        return NextResponse.json({ success: true, message: 'Successfully deleted comment.' });

    } catch (error: any) {
        console.error('Delete Comment Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete comment' }, { status: 500 });
    }
}
