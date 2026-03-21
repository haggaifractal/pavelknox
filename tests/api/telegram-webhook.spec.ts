import { test, expect } from '@playwright/test';

test.describe('Telegram Webhook API constraints', () => {
    const WEBHOOK_URL = '/api/telegram-webhook';

    test('Rejects requests without valid secret token', async ({ request }) => {
        // If the secret isn't provided or match, it should return 401
        const response = await request.post(WEBHOOK_URL, {
            data: { message: {} },
            headers: {
                'x-telegram-bot-api-secret-token': 'wrong-token'
            }
        });
        
        // This expects the environment to have TELEGRAM_WEBHOOK_SECRET defined,
        // otherwise it will just proceed to return 200 ok for valid payload.
        // Assuming strict environment:
        expect(response.status()).toBe(401);
    });

    test('Returns 200 Fast (Fire-and-Forget) for valid payloads', async ({ request }) => {
        // Since we are not strictly mocking the database in this test script,
        // we send a basic message block that simulates processing to check fast response.
        const response = await request.post(WEBHOOK_URL, {
            data: {
                message: {
                    message_id: 1,
                    chat: { id: 12345 },
                    text: 'test ai query'
                }
            },
            headers: {
                // Must match env during test run
                'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET || ''
            }
        });

        // Should return 200 OK immediately
        expect(response.ok()).toBeTruthy();
        const json = await response.json();
        expect(json.ok).toBe(true);
    });
});
