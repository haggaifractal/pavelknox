import { AzureOpenAI } from 'openai';

delete process.env.AZURE_OPENAI_BASE_URL;
delete process.env.OPENAI_BASE_URL;

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'dummy_key_for_build',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://dummy.openai.azure.com',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
});

// Using standard GPT-4o deployments
const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID || 'gpt-4o';

export interface ParsedKnowledge {
    title: string;
    clientName?: string | null;
    category: 'commercial' | 'technical' | 'quirks' | 'other';
    content: string;
    tags: string[];
    isUrgent: boolean;
}

export interface ParsedKnowledgeResult {
    data: ParsedKnowledge;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function extractAndRedactKnowledge(rawText: string, knownClients?: string): Promise<ParsedKnowledgeResult> {
    const systemPrompt = `
אתה סוכן AI חכם ובטוח לחילוץ וסידור ידע עסקי וארגוני מתוך הודעות.

המשימות שלך:
1. צנזורה ופרטיות: חובה עליך להחליף סיסמאות קשיחות (Passwords), מפתחות הצפנה (API keys) או טוקנים סודיים למחרוזת "[REDACTED]". לגבי מידע אישי מזהה (PII): התייחס לכתובות אימייל, מספרי טלפון ושמות לקוחות/עובדים בזהירות. ארגן אותם בצורה ברורה בטקסט כדי שניתן יהיה לזהות אותם בקלות אם יידרש בעתיד, אך אל תצנזר אותם בשלב זה (אנו מסתמכים על תאימות האבטחה של Azure).
2. דחיפות: כלל ברזל - אם המשתמש מציין שההודעה "דחופה", "קריטית", "בהולה", או מבקש לטפל בזה "עכשיו", עליך להחזיר את הערך "isUrgent" כ-true. אחרת, החזר false.
3. קטלוג: סווג את התוכן לאחת מהקטגוריות הבאות באנגלית בלבד: 'commercial', 'technical', 'quirks', 'other'.
4. סידור ויצירת ידע: צור כותרת עניינית קצרה (title), ארגן את הטקסט המסוכם והחכם למבנה קריא בסגנון Markdown בתוך השדה (content), וחלץ 2-5 תגיות רלוונטיות (tags). בנוסף, זהה לאיזה לקוח המידע רלוונטי וחלץ את שם הלקוח במדויק מתוך הטקסט לתוך השדה (clientName). 
5. חילוץ שמות לקוחות - **חובה קריטית למערכת הקצאת משימות:** 
אם שם הלקוח מופיע בטקסט (במפורש או במרומז), או אם ייצרת כותרת שמכילה שם של לקוח - אתה חייב להעתיק את אותו שם לקוח במדויק לתוך השדה "clientName" ב-JSON!
${knownClients ? `הנה רשימת לקוחות מוכרים במערכת שלנו: ${knownClients}. חפש אותם בטקסט, ואם מצאת אחד מהם - השתמש בשם הזה בדיוק עבור השדה clientName.` : ''} 
בשום מצב אל תשאיר את השדה הזה ריק או null אם זיהית (או אם כתבת) לקוח בכותרת/בטקסט.
6. פרוטוקול שפה: חובה עליך להוציא את כל הפלט (כותרת, תוכן, תגיות, שם לקוח) אך ורק בשפה העברית! אל תתרגם את השפה במקור לאנגלית לעולם. אל תכתוב הערות צד מצדך כמו "המשתמש שאל..". רק תארגן את הידע הגולמי העסקי. אם הפלט הוא רק שיחת חולין, שקף את זה כמו שזה.

הפלט חייב להיות אובייקט JSON תקין לחלוטין התואם לסכמה הזו בדיוק (כשהערכים בעברית לחלוטין למעט הקטגוריה ואמת/שקר):
{
  "title": "כותרת קצרה",
  "clientName": "שם הלקוח",
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

        return {
            data: JSON.parse(result) as ParsedKnowledge,
            usage: response.usage as any
        };
    } catch (error) {
        console.error('GPT Extraction Error:', error);
        throw error;
    }
}
