import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'dummy_key_for_build',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://dummy.openai.azure.com',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
});

// Using standard GPT-4o deployments
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID || 'gpt-4o';

export interface ParsedKnowledge {
    title: string;
    category: 'commercial' | 'technical' | 'quirks' | 'other';
    content: string;
    tags: string[];
    isUrgent: boolean;
}

export async function extractAndRedactKnowledge(rawText: string): Promise<ParsedKnowledge> {
    const systemPrompt = `
אתה סוכן AI חכם ובטוח לחילוץ וסידור ידע עסקי וארגוני מתוך הודעות.

המשימות שלך:
1. צנזורה: חובה עליך להחליף סיסמאות קשיחות (Passwords), מפתחות הצפנה (API keys) או טוקנים סודיים למחרוזת "[REDACTED]". שים לב: כתובות אימייל, מספרי טלפון, ושמות לקוחות/עובדים הם *לא* סודות ואין לצנזר אותם לעולם!
2. דחיפות: כלל ברזל - אם המשתמש מציין שההודעה "דחופה", "קריטית", "בהולה", או מבקש לטפל בזה "עכשיו", עליך להחזיר את הערך "isUrgent" כ-true. אחרת, החזר false.
3. קטלוג: סווג את התוכן לאחת מהקטגוריות הבאות באנגלית בלבד: 'commercial', 'technical', 'quirks', 'other'.
4. סידור ויצירת ידע: צור כותרת עניינית קצרה (title), ארגן את הטקסט המסוכם והחכם למבנה קריא בסגנון Markdown בתוך השדה (content), וחלץ 2-5 תגיות רלוונטיות (tags).
5. פרוטוקול שפה: חובה עליך להוציא את כל הפלט (כותרת, תוכן, תגיות) אך ורק בשפה העברית! אל תתרגם את השפה במקור לאנגלית לעולם. אל תכתוב הערות צד מצדך כמו "המשתמש שאל..". רק תארגן את הידע הגולמי העסקי. אם הפלט הוא רק שיחת חולין, שקף את זה כמו שזה.

הפלט חייב להיות אובייקט JSON תקין לחלוטין התואם לסכמה הזו בדיוק (כשהערכים בעברית לחלוטין למעט הקטגוריה ואמת/שקר):
{
  "title": "כותרת קצרה",
  "category": "commercial|technical|quirks|other",
  "isUrgent": false,
  "content": "המידע המסודר בפורמט מרקדאון...",
  "tags": ["תגית1", "תגית2"]
}
`;

    try {
        const response = await client.chat.completions.create({
            model: deploymentId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: rawText }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2, // Low temperature for consistent JSON and redaction reliability
        });

        const result = response.choices[0]?.message?.content;
        if (!result) throw new Error('No content returned from GPT');

        return JSON.parse(result) as ParsedKnowledge;
    } catch (error) {
        console.error('GPT Extraction Error:', error);
        throw error;
    }
}
