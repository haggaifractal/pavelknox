const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function getFileUrl(fileId: string): Promise<string | null> {
    if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (!data.ok) {
        console.error('Telegram getFile failed:', data);
        return null;
    }
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

export async function downloadFileAsBuffer(fileUrl: string, retries = 2): Promise<Buffer> {
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
            
            const res = await fetch(fileUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error: any) {
            if (i === retries) throw error;
            console.warn(`Download attempt ${i + 1} failed, retrying...`, error.message);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
    throw new Error('All download attempts failed');
}
