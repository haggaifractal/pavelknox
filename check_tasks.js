const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "pavelknox-b5781",
    });
}

const db = admin.firestore();

async function checkTasks() {
    console.log('Fetching tasks...');
    const snapshot = await db.collection('tasks').orderBy('createdAt', 'desc').limit(5).get();
    
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Task ID: ${doc.id}`);
        console.log(`Description: ${data.description}`);
        console.log(`ClientName: "${data.clientName}"`);
        console.log('---');
    });
}

checkTasks().catch(console.error);
