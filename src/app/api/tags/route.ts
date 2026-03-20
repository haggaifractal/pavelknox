import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdmin } from '@/lib/firebase/serverAuth';

export async function GET(request: Request) {
    try {
        const auth = await verifyAdmin(request);
        if (!auth) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const tagsSnapshot = await adminDb.collection('tags').orderBy('label').get();
        const tags = tagsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ tags });
    } catch (error: any) {
        console.error('List tags error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await verifyAdmin(request);
        if (!auth) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { label, colorHex } = await request.json();

        if (!label || !colorHex) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Concurrency/Duplicate protect
        const existingTags = await adminDb.collection('tags').where('label', '==', label).get();
        if (!existingTags.empty) {
            return NextResponse.json({ error: 'Tag with this label already exists' }, { status: 409 });
        }

        const tagRef = adminDb.collection('tags').doc();
        const newTag = {
            id: tagRef.id,
            label,
            colorHex,
            usageCount: 0,
            createdBy: auth.uid,
            createdAt: new Date().toISOString()
        };

        await tagRef.set(newTag);

        return NextResponse.json({ tag: newTag });
    } catch (error: any) {
        console.error('Create tag error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
