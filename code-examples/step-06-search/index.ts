import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { pipeline } from '@huggingface/transformers';

/**
 * Step 6: Semantic Search
 * 
 * This example demonstrates:
 * 1. Generating a query embedding
 * 2. Performing a similarity search using cosine distance (<=>)
 * 3. Ranking results by similarity score
 */

async function main() {
  const db = new PGlite({ extensions: { vector } });
  await db.waitReady;
  await db.exec('CREATE EXTENSION IF NOT EXISTS vector');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id SERIAL PRIMARY KEY,
      content TEXT,
      embedding vector(384)
    )
  `);

  console.log('🤖 Loading embedding model...');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const corpus = [
    'The quick brown fox jumps over the lazy dog',
    'Artificial Intelligence is transforming the world',
    'A coding assistant helps developers write better code',
    'Cloud computing allows for scalable infrastructure'
  ];

  console.log('📥 Indexing corpus...');
  for (const text of corpus) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    await db.query('INSERT INTO docs (content, embedding) VALUES ($1, $2)', [text, JSON.stringify(embedding)]);
  }

  // Define Search Function
  async function semanticSearch(query: string, limit = 2) {
    console.log(`\n🔎 Searching for: "${query}"`);
    
    // 1. Embed the query
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data as Float32Array);

    // 2. Query PGlite using cosine distance
    // (1 - distance) gives us the similarity score
    const results = await db.query(`
      SELECT content, 1 - (embedding <=> $1) as similarity
      FROM docs
      ORDER BY similarity DESC
      LIMIT $2
    `, [JSON.stringify(queryEmbedding)]);

    return results.rows;
  }

  // Test Search
  const results1 = await semanticSearch('machine learning and software');
  console.table(results1);

  const results2 = await semanticSearch('fast animals');
  console.table(results2);
}

main().catch(console.error);
