import { EmbeddingService } from './embeddings';
import { VectorDatabase } from './pglite';

export interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export class SearchService {
  static async search(query: string, limit = 5): Promise<SearchResult[]> {
    const db = await VectorDatabase.getInstance();
    const embedding = await EmbeddingService.generate(query);

    const result = await db.query(
      `SELECT id, content, metadata, 1 - (embedding <=> $1) as similarity
       FROM documents
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [JSON.stringify(embedding), limit]
    );

    return result.rows as unknown as SearchResult[];
  }
}
