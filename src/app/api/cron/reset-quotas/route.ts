import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: Request) {
    try {
        // Vercel Cron Authentication
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let updatedCount = 0;

        // Reset Web Users
        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.get();
        
        const batches = [];
        let currentBatch = adminDb.batch();
        let operationCount = 0;

        snapshot.docs.forEach((doc) => {
            currentBatch.update(doc.ref, { tokensUsedThisMonth: 0 });
            operationCount++;
            
            if (operationCount === 400) {
                batches.push(currentBatch.commit());
                currentBatch = adminDb.batch();
                operationCount = 0;
            }
            updatedCount++;
        });

        if (operationCount > 0) {
            batches.push(currentBatch.commit());
        }

        await Promise.all(batches);

        return NextResponse.json({ 
            success: true, 
            message: `Reset quotas for ${updatedCount} web users.` 
        });
    } catch (error: any) {
        console.error('Failed to reset quotas:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
