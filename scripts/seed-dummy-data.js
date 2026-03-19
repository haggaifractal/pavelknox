require('dotenv').config({ path: '../.env.local' });
const admin = require('firebase-admin');

// Prepare the private key
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
}

const db = admin.firestore();

const dummyDrafts = [
    {
        status: 'pending',
        text: 'פגישת צוות הבוקר: חגי הציע שנשנה את הארכיטקטורה של מנגנון הייבוא באפליקציה כדי לעבוד עם Web Workers, זה ימנע ממסך ה-UI להיתקע. חייב להזכיר לצוות לבדוק את זה בהקדם.',
        audioFileId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        chatId: 123456,
        messageId: 101,
    },
    {
        status: 'pending',
        text: 'רעיון למיזם חדש: מערכת שתעשה אוטומציה של הודעות טלגרם למאגר ידע. קראתי לזה PavelKnox במקרה, אבל זה יכול לעבוד. צריך לחקור מודלי AI שיתמצת את זה בצורה חכמה.',
        audioFileId: 'AwQD123145124124',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        chatId: 123456,
        messageId: 102,
    },
    {
        status: 'pending',
        text: 'לשאול את רואה החשבון האם אנחנו יכולים להזדכות על ההוצאות של שרתי גוגל מהפרויקט האחרון. יש מסמך מרואי חשבון בדרופבוקס.',
        audioFileId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        chatId: 123456,
        messageId: 103,
    }
];

async function seed() {
    console.log('Seeding dummy drafts...');
    const batch = db.batch();
    for (const draft of dummyDrafts) {
        const docRef = db.collection('raw_inputs').doc();
        batch.set(docRef, draft);
    }
    await batch.commit();
    console.log('✅ Successfully added dummy drafts to Firestore!');
    process.exit(0);
}

seed().catch(console.error);
