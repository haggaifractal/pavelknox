import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
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
            return NextResponse.json({ error: 'Missing required tag ID' }, { status: 400 });
        }

        const tagRef = adminDb.collection('tags').doc(id);
        const tagDoc = await tagRef.get();

        if (!tagDoc.exists) {
            return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
        }

        const tagData = tagDoc.data();

        // 1. Delete the tag document
        await tagRef.delete();

        // 2. Cascade delete tag from drafts
        const draftsSnapshot = await adminDb.collection('drafts')
            .where('tags', 'array-contains', id)
            .get();

        const batch = adminDb.batch();
        let affectedDrafts = 0;
        
        draftsSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                tags: FieldValue.arrayRemove(id)
            });
            affectedDrafts++;
        });

        // 3. Cascade delete tag from knowledge base
        const knowledgeSnapshot = await adminDb.collection('knowledge_base')
            .where('tags', 'array-contains', id)
            .get();

        let affectedKnowledge = 0;
        knowledgeSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                tags: FieldValue.arrayRemove(id)
            });
            affectedKnowledge++;
        });

        // Commit all array-removes
        if (affectedDrafts > 0 || affectedKnowledge > 0) {
            await batch.commit();
        }

        // Log the action
        await createAuditLog({
            actionType: 'DELETE_TAG',
            userId: auth.uid,
            userEmail: auth.email || 'unknown',
            targetId: id,
            details: {
                tagName: tagData?.label,
                affectedDrafts,
                affectedKnowledgeDocuments: affectedKnowledge
            }
        });

        return NextResponse.json({ 
            success: true, 
            affectedDrafts, 
            affectedKnowledge 
        });
    } catch (error: any) {
        console.error('Error deleting tag:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
