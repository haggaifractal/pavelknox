import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getFileUrl, downloadFileAsBuffer } from '@/services/telegram/client';
import { transcribeAudio } from '@/services/ai/whisper';
import { extractAndRedactKnowledge } from '@/services/ai/gpt';

async function processIngestionAsync(docId: string, payload: any, uid: string) {
    try {
        console.log(`Starting background processing for doc: ${docId}`);

        // Fetch known clients to improve AI extraction accuracy
        const clientsSnap = await adminDb.collection('clients').get();
        const knownClients = clientsSnap.docs.map(d => d.data().name).filter(Boolean).join(', ');

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

        const chatIdStr = payload?.message?.chat?.id?.toString() || 'unknown';

        // 1.5 Security Limits Check
        const userRef = adminDb.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const currentTokens = userData?.tokensUsedThisMonth || 0;
        const maxTokens = userData?.monthlyTokenLimit || 5000000; // 5M tokens default

        if (currentTokens >= maxTokens) {
             const botToken = process.env.TELEGRAM_BOT_TOKEN;
             if (chatIdStr !== 'unknown' && botToken) {
                 await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                         chat_id: chatIdStr,
                         text: `❌ הגעת למגבלת האבטחה החודשית של הבוט (${maxTokens} טוקנים). לא ניתן לקלוט מידע נוסף החודש.`
                     })
                 });
             }
             console.error(`User ${uid} reached high security token limit.`);
             return; // Abort processing
        }

        // 2. צנזור וארגון מחדש דרך GPT
        const extractionResult = await extractAndRedactKnowledge(extractedText, knownClients);
        const parsedData = extractionResult.data;
        const usage = extractionResult.usage;

        const totalTokens = usage?.total_tokens || 0;
        const { FieldValue } = await import('firebase-admin/firestore');
        
        await userRef.set({
            tokensUsedThisMonth: FieldValue.increment(totalTokens),
            lifetimeTokensUsed: FieldValue.increment(totalTokens),
            lastActivityDate: new Date()
        }, { merge: true });

        // Audit log for AI interaction
        await adminDb.collection('ai_chat_logs').add({
            timestamp: new Date(),
            query: extractedText,
            response: JSON.stringify(parsedData),
            source: 'Telegram',
            userId: uid,
            telegramChatId: chatIdStr,
            promptTokens: usage?.prompt_tokens || 0,
            completionTokens: usage?.completion_tokens || 0,
            totalTokens: totalTokens
        }).catch(err => console.error('Failed to log Telegram interaction:', err));

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
        const draftRef = await adminDb.collection('drafts').add({
            title: parsedData.title || 'ללא כותרת',
            text: parsedData.content || extractedText,
            originalText: extractedText,
            clientName: parsedData.clientName || null,
            category: parsedData.category || 'other',
            tags: parsedData.tags || [],
            isUrgent: parsedData.isUrgent || false,
            status: 'pending',
            originalInputId: docId,
            isDuplicate,
            duplicateSourceUrl,
            createdBy: uid,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Audit Log for creating a new draft
        await adminDb.collection('audit_logs').add({
            action: 'CREATED_DRAFT',
            userId: uid,
            userName: userData?.displayName || 'Unknown',
            resourceId: draftRef.id,
            details: `משתמש יצר טיוטה חדשה בטלגרם: ${parsedData.title}`,
            timestamp: new Date()
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
            const userName = userData?.displayName || '';
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pavelknox-b5781.web.app';
            const draftUrl = `${baseUrl}/drafts/${draftRef.id}`;
            
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `תודה ${userName}, המידע נשמר בהצלחה! ✅\nכותרת: [${parsedData.title || 'ללא כותרת'}](${draftUrl})`,
                    parse_mode: 'Markdown'
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

        // Deduplication (Idempotency) Check using Telegram's update_id
        if (payload.update_id) {
            const updateIdStr = payload.update_id.toString();
            const updateRef = adminDb.collection('telegram_updates').doc(updateIdStr);
            try {
                // Atomically create the document. If it already exists, this will throw an error.
                await updateRef.create({ timestamp: new Date() });
            } catch (err: any) {
                if (err.code === 6 || err.message?.includes('ALREADY_EXISTS')) {
                    console.log(`Update ${updateIdStr} already processed (concurrent). Skipping duplicate webhook.`);
                    return NextResponse.json({ ok: true });
                }
                console.error("Error creating telegram_updates doc:", err);
            }
        }

        if (!payload.message) {
            return NextResponse.json({ ok: true });
        }

        const { message_id, chat, text, voice } = payload.message;
        const chatIdStr = chat?.id?.toString();

        if (!chatIdStr) return NextResponse.json({ ok: true });

        // בקרת גישה (Authorization) ספציפית דרך אוסף users
        const usersSnapshot = await adminDb.collection('users')
          .where('telegramChatId', '==', chatIdStr)
          .limit(1)
          .get();

        if (usersSnapshot.empty) {
            // לא מורשה - נחזיר את מזהה הטלגרם למשתמש כדי שיוכל לתת למנהל
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chat.id,
                        text: `לא מורשה! כדי להתחבר למערכת, אנא העבר למנהל המערכת את מזהה הטלגרם שלך: \`${chatIdStr}\``,
                        parse_mode: 'Markdown'
                    })
                }).catch(e => console.error('Failed to send auth rejection', e));
            }
            console.warn(`Unauthorized telegram webhook attempt from chat id: ${chatIdStr}`);
            return NextResponse.json({ ok: true }); // חשוב להחזיר 200 כדי שטלגרם לא תנסה שוב
        }

        const uid = usersSnapshot.docs[0].id;

        const hasAudio = !!voice?.file_id;
        const hasText = !!text;

        // Fallback for unsupported messages
        if (!hasAudio && !hasText) {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chat.id,
                        text: `⚠️ סוג ההודעה ששלחת אינו נתמך כרגע. המערכת יודעת לקלוט הודעות טקסט או הודעות קוליות (Voice Messages) בלבד.`
                    })
                }).catch(e => console.error('Failed to send fallback notice', e));
            }
            console.warn(`Unsupported message type from chat id: ${chatIdStr}`);
            return NextResponse.json({ ok: true });
        }

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

        if (hasAudio || hasText) {
            processIngestionAsync(docRef.id, payload, uid).catch(console.error);
        }

        // חובה להחזיר 200 מהר כדי שטלגרם לא תשלח את ההודעה שוב בלופ
        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ ok: true });
    }
}
