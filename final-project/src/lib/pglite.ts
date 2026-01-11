import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

export class VectorDatabase {
  private static instance: PGlite | null = null;

  static async getInstance(): Promise<PGlite> {
    if (this.instance) return this.instance;

    this.instance = new PGlite('idb://vector-meanings-db', {
      extensions: { vector },
    });

    await this.instance.waitReady;
    await this.instance.exec('CREATE EXTENSION IF NOT EXISTS vector');
    
    await this.instance.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(384),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return this.instance;
  }
}
