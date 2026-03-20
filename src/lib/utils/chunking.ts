/**
 * Splits a text into chunks of approximately `chunkSize` characters
 * with an `overlap` to preserve context.
 * Default 2000 chars is roughly 350-450 words.
 */
export function chunkText(text: string, chunkSize: number = 2000, overlap: number = 300): string[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    let end = Math.min(i + chunkSize, text.length);

    if (end < text.length) {
      // Find a natural break (newline or space) near the end of the chunk
      const lastNewline = text.lastIndexOf('\n', end);
      const lastSpace = text.lastIndexOf(' ', end);
      
      const bestBreak = Math.max(lastNewline, lastSpace);
      
      // If we found a break in the last 20% of the chunk, cut there
      if (bestBreak > i + (chunkSize * 0.8)) {
        end = bestBreak;
      }
    }

    const chunk = text.slice(i, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    if (end >= text.length) break;
    
    // Advance, stepping back by overlap
    i = end - overlap;
  }

  return chunks;
}
