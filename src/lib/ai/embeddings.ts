export async function generateEmbedding(text: string): Promise<number[]> {
  const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_EMBEDDING_API_KEY;
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Missing Azure OpenAI Embedding environment variables');
  }

  const cleanEndpoint = endpoint.replace(/\/$/, "");
  const url = `${cleanEndpoint}/openai/deployments/${deployment}/embeddings?api-version=2023-05-15`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      input: text.replace(/\n/g, ' '), // Openai recommends replacing newlines with spaces for embeddings
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Azure OpenAI Error:", errorText);
    throw new Error(`Failed to generate embedding: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data[0].embedding;
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const embeddings = [];
  for (const text of texts) {
    embeddings.push(await generateEmbedding(text));
  }
  return embeddings;
}
