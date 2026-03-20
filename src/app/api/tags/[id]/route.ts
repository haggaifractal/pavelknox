import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/serverAuth';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const auth = await verifyAuth(request);
        if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const params = await context.params;
        const tagId = params.id;

        // Perform a Batch Write to remove this tag from all drafts and knowledge items where it is used.
        // Actually, for NoSQL, finding all documents containing the tag ID and removing it can be heavy.
        // For enterprise resilience, we should limit to batches of 500 max, or use a background Cloud Function.
        // Here we do a single batch for up to 500 documents.
        const batch = adminDb.batch();
        const tagRef = adminDb.collection('tags').doc(tagId);
        
        // Find drafts with this tag
        const draftsSnapshot = await adminDb.collection('drafts').where('tags', 'array-contains', tagId).limit(500).get();
        draftsSnapshot.docs.forEach(doc => {
            const currentTags = doc.data().tags || [];
            batch.update(doc.ref, { tags: currentTags.filter((t: string) => t !== tagId) });
        });

        // Find knowledge_base items with this tag
        const kbSnapshot = await adminDb.collection('knowledge_base').where('tags', 'array-contains', tagId).limit(500).get();
        kbSnapshot.docs.forEach(doc => {
            const currentTags = doc.data().tags || [];
            batch.update(doc.ref, { tags: currentTags.filter((t: string) => t !== tagId) });
        });

        batch.delete(tagRef);
        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete tag error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
    try {
        const auth = await verifyAuth(request);
        if (!auth || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const params = await context.params;
        const tagId = params.id;
        const updates = await request.json();

        await adminDb.collection('tags').doc(tagId).update({
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.uid
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update tag error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
