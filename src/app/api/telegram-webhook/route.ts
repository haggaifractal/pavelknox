import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getFileUrl, downloadFileAsBuffer } from '@/services/telegram/client';
import { transcribeAudio } from '@/services/ai/whisper';
import { extractAndRedactKnowledge } from '@/services/ai/gpt';

async function processIngestionAsync(docId: string, payload: any) {
    try {
        console.log(`Starting background processing for doc: ${docId}`);

        // 1. חילוץ האודיו או הטקסט
        const { voice, text } = payload.message;
        let extractedText = text || '';

        if (voice?.file_id) {
            const fileUrl = await getFileUrl(voice.file_id);
            if (fileUrl) {
                const audioBuffer = await downloadFileAsBuffer(fileUrl);
                extractedText = await transcribeAudio(audioBuffer, 'voice_message.ogg');
            }
        }

        if (!extractedText.trim()) {
            throw new Error('No readable text or audio found in the payload');
        }

        console.log(`Successfully extracted raw text for doc: ${docId}, proceeding to GPT parsing`);

        // 2. צנזור וארגון מחדש דרך GPT
        const parsedData = await extractAndRedactKnowledge(extractedText);

        // 2.5 Duplicate Detection via Vector Search
        let isDuplicate = false;
        let duplicateSourceUrl = "";
        try {
            const { generateEmbedding } = await import('@/lib/ai/embeddings');
            const { FieldValue } = await import('firebase-admin/firestore');
            const embedding = await generateEmbedding(extractedText);
            
            const snapshot = await adminDb.collection("knowledge_chunks").findNearest('embedding', FieldValue.vector(embedding), {
                limit: 1,
                distanceMeasure: 'COSINE',
                distanceResultField: 'vectorDistance'
            } as any).get();

            if (!snapshot.empty) {
                const closestDoc = snapshot.docs[0].data();
                // 0.06 distance ~= 0.94 cosine similarity
                if (closestDoc.vectorDistance !== undefined && closestDoc.vectorDistance < 0.06) {
                    isDuplicate = true;
                    duplicateSourceUrl = closestDoc.sourceUrl || `/knowledge/${closestDoc.sourceId}`;
                    console.log(`Duplicate detected for doc ${docId}. Matches source: ${duplicateSourceUrl} with distance: ${closestDoc.vectorDistance}`);
                }
            }
        } catch (err: any) {
            console.error('Duplicate detection failed (ignoring and continuing):', err.message);
        }

        // 3. יצירת טיוטה (Draft) חדשה במערכת עם הסטטוס pending
        await adminDb.collection('drafts').add({
            ...parsedData,
            status: 'pending',
            originalInputId: docId,
            isDuplicate,
            duplicateSourceUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // 4. עדכון רשומת ה-raw_inputs בטקסט המקורי וסטטוס מעובד
        await adminDb.collection('raw_inputs').doc(docId).update({
            text: extractedText,
            status: 'processed',
            updatedAt: new Date()
        });

        console.log(`Successfully parsed, drafted and redacted doc: ${docId}`);

        // 5. Send confirmation back to Telegram
        const chatId = payload?.message?.chat?.id;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `✅ נשמר בהצלחה!\n\nכותרת: ${parsedData.title}\nקטגוריה: ${parsedData.category}\n\nהטיוטה ממתינה ב-Inbox באתר.`
                })
            }).catch(e => console.error('Failed to send Telegram confirmation:', e));
        }

    } catch (error) {
        console.error('Background ingestion processing failed:', error);
        await adminDb.collection('raw_inputs').doc(docId).update({
            status: 'error',
            errorDetails: String(error),
            updatedAt: new Date()
        }).catch(console.error);

        // Send error notice to Telegram
        const chatId = payload?.message?.chat?.id;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `❌ שגיאה בקליטת ההודעה או בפענוח ה-AI. אנא נסה שנית, או בדוק שגיאות במסוף.`
                })
            }).catch(e => console.error('Failed to send Telegram error notice:', e));
        }
    }
}

export async function POST(request: Request) {
    try {
        const payload = await request.json();

        // בטיחות: וידוא טוקן סודי מטלגרם שרק אנחנו מכירים
        const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
        if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!payload.message) {
            return NextResponse.json({ ok: true });
        }

        const { message_id, chat, text, voice } = payload.message;
        const hasAudio = !!voice?.file_id;
        const hasText = !!text;

        // רשומת raw התחלתית
        const rawInput = {
            messageId: message_id,
            chatId: chat.id,
            text: null,
            audioFileId: voice?.file_id || null,
            status: (hasAudio || hasText) ? 'processing' : 'received',
            createdAt: new Date(),
            payloadDump: payload
        };

        // שמירה מהירה לדאטה-בייס לפני החזרת התשובה
        const docRef = await adminDb.collection('raw_inputs').add(rawInput);

        // אם קיים מידע לעיבוד (טקסט או קול) - נריץ ברקע וללא המתנה (Fire and forget)
        if (hasAudio || hasText) {
            processIngestionAsync(docRef.id, payload).catch(console.error);
        }

        // חובה להחזיר 200 מהר כדי שטלגרם לא תשלח את ההודעה שוב בלופ
        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ ok: true });
    }
}
