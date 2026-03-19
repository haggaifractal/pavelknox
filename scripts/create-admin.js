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

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
    console.log('Usage: node scripts/create-admin.js <email> <password>');
    process.exit(1);
}

admin.auth().createUser({
    email: email,
    password: password,
    emailVerified: true,
})
    .then((userRecord) => {
        console.log('✅ Successfully created new admin user:', userRecord.uid);
        process.exit(0);
    })
    .catch((error) => {
        console.log('❌ Error creating new user:', error.message);
        process.exit(1);
    });
