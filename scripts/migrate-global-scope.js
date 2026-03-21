const admin = require('firebase-admin');

// IMPORTANT: Set this environment variable to the path of your Firebase Admin Service Account key JSON file.
// Example: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
    console.log('Please export the path to your Firebase service account key JSON file.');
    console.log('Example: export GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function migrateCollection(collectionName) {
    console.log(`\nStarting migration for collection: ${collectionName}`);
    const snapshot = await db.collection(collectionName).get();
    
    let updatedCount = 0;
    const batchArray = [];
    let currentBatch = db.batch();
    let batchCount = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        
        // Only update if visibilityScope is missing
        if (!data.visibilityScope) {
            currentBatch.update(doc.ref, {
                visibilityScope: 'global',
                departmentIds: []
            });
            
            updatedCount++;
            batchCount++;
            
            // Firestore batches can hold up to 500 operations
            if (batchCount === 500) {
                batchArray.push(currentBatch.commit());
                currentBatch = db.batch();
                batchCount = 0;
            }
        }
    });

    if (batchCount > 0) {
        batchArray.push(currentBatch.commit());
    }

    await Promise.all(batchArray);
    console.log(`✅ Successfully updated ${updatedCount} documents in ${collectionName}`);
}

async function runMigration() {
    try {
        await migrateCollection('knowledge_base');
        await migrateCollection('drafts');
        await migrateCollection('tasks');
        
        console.log('\n🎉 Scope Migration Completed Successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        process.exit();
    }
}

runMigration();
