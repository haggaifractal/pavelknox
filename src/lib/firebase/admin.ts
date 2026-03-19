import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    try {
        if (!process.env.FIREBASE_PRIVATE_KEY) {
            return initializeApp();
        }

        return initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    } catch (error: any) {
        console.warn('Firebase Admin Initialization Warning:', error.message);
        if (getApps().length > 0) {
            return getApps()[0];
        }
        throw error;
    }
}

const app = getAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
