const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables manually from .env.local to avoid requiring 'dotenv' dependency
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    // Basic .env parser
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      // Remove wrapping quotes if present
      const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
      const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
      if (isDoubleQuoted || isSingleQuoted) {
        value = value.slice(1, -1);
      }
      process.env[key] = process.env[key] || value;
    }
  });
}

// Parse command line arguments
const email = process.argv[2];
const role = process.argv[3] || 'superadmin';

if (!email) {
  console.log("Usage: node scripts/set-admin.js <user-email> [role]");
  console.log("Example: node scripts/set-admin.js pavel.knox@gmail.com superadmin");
  process.exit(1);
}

// Initialize Firebase Admin using env variables
try {
  let credential;
  
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('Initializing with environment variables from .env.local...');
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Handle the newline characters in the private key correctly
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else {
    console.log('Environment variables not found. Attempting to initialize with default credentials...');
    admin.initializeApp();
  }

  if (credential && !admin.apps.length) {
      admin.initializeApp({
        credential: credential
      });
  }
} catch(e) {
  console.error("Failed to initialize Firebase Admin:");
  console.error(e.message);
  process.exit(1);
}

// Set the custom claim
async function setRole() {
  try {
    console.log(`Looking up user with email: ${email}...`);
    const user = await admin.auth().getUserByEmail(email);
    
    console.log(`Found user: ${user.uid}. Setting role to '${role}'...`);
    await admin.auth().setCustomUserClaims(user.uid, { role: role });
    
    console.log(`✅ Success! User ${email} is now a ${role}.`);
    console.log(`IMPORTANT: The user must sign out and sign back in for the new token claims to take effect.`);
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
        console.error("❌ Error: User not found. The user must sign in to the app at least once before you can assign a role.");
    } else {
        console.error("❌ Error setting custom claims:", error.message);
    }
    process.exit(1);
  }
}

setRole();
