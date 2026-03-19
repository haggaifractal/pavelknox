import { AzureOpenAI } from 'openai';
import { toFile } from 'openai/uploads';

const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'dummy_key_for_build',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://dummy.openai.azure.com',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
});

export async function transcribeAudio(audioBuffer: Buffer, fileName: string = 'voice_message.ogg'): Promise<string> {
    try {
        const file = await toFile(audioBuffer, fileName);
        const deploymentId = process.env.AZURE_OPENAI_DEPLOYMENT_ID || 'whisper';

        const response = await client.audio.transcriptions.create({
            file: file,
            model: deploymentId,
        });

        return response.text;
    } catch (error) {
        console.error('Whisper Transcription Error:', error);
        throw error;
    }
}
