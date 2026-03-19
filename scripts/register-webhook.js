require('dotenv').config({ path: '../.env.local' });
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.argv[2]; // e.g., https://my-app.vercel.app/api/telegram-webhook
const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN is missing from your .env.local file.');
    process.exit(1);
}

if (!WEBHOOK_URL) {
    console.error('Usage: node scripts/register-webhook.js <YOUR_PUBLIC_WEBHOOK_URL>');
    console.error('Example: node scripts/register-webhook.js https://my-ngrok.ngrok.io/api/telegram-webhook');
    process.exit(1);
}

const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;

let postData = JSON.stringify({
    url: WEBHOOK_URL,
    secret_token: SECRET_TOKEN || undefined
});

const req = https.request(apiUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
}, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${rawData}`);
        if (res.statusCode === 200) {
            console.log('✅ Webhook registered successfully!');
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
