import { EmbeddingService } from './embeddings';
import { VectorDatabase } from './pglite';

export interface DocumentChunk {
  content: string;
  metadata: Record<string, unknown>;
}

export class IngestionService {
  static async ingest(content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const db = await VectorDatabase.getInstance();
    const chunks = this.chunkText(content);

    for (const chunk of chunks) {
      const embedding = await EmbeddingService.generate(chunk);
      await db.query(
        'INSERT INTO documents (content, embedding, metadata) VALUES ($1, $2, $3)',
        [chunk, JSON.stringify(embedding), JSON.stringify(metadata)]
      );
    }
  }

  private static chunkText(text: string, size = 250, overlap = 40): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      chunks.push(text.slice(start, end));
      start += size - overlap;
    }

    return chunks;
  }
}
