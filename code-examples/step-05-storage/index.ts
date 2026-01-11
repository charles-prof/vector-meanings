import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

/**
 * Step 5: Vector Storage and Indexing
 * 
 * This example demonstrates:
 * 1. Creating a table with vector support
 * 2. Understanding Index types (IVFFlat vs HNSW)
 * 3. Storing metadata alongside vectors
 */

async function main() {
  const db = new PGlite({
    extensions: { vector },
  });

  await db.waitReady;
  await db.exec('CREATE EXTENSION IF NOT EXISTS vector');

  // Step 1: Create table with a vector column (dimension 384 for MiniLM)
  // We also add a JSONB column for flexible metadata
  await db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      metadata JSONB,
      embedding vector(384)
    );
  `);

  console.log('✅ Table created with vector(384) and JSONB metadata');

  // Step 2: Create an HNSW index
  // HNSW (Hierarchical Navigable Small Worlds) is the state-of-the-art for vector search.
  // It's faster and more accurate than IVFFlat but uses more memory.
  console.log('🏗️ Creating HNSW index...');
  await db.exec(`
    CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `);
  console.log('✅ HNSW index created');

  // Step 3: Insert data with metadata
  console.log('📥 Inserting documents with metadata...');
  const sampleVector = new Array(384).fill(0).map(() => Math.random());
  
  await db.query(`
    INSERT INTO items (content, metadata, embedding) 
    VALUES ($1, $2, $3)`,
    [
      'Local vector storage is efficient',
      JSON.stringify({ category: 'tech', priority: 1 }),
      JSON.stringify(sampleVector)
    ]
  );

  // Step 4: Verify storage
  const count = await db.query('SELECT count(*) FROM items');
  console.log(`📊 Documents in database: ${(count.rows[0] as any).count}`);

  // Step 5: Search with metadata filter
  console.log('🔍 Performing filtered search...');
  const filtered = await db.query(`
    SELECT content, metadata->>'category' as cat
    FROM items
    WHERE metadata->>'category' = 'tech'
  `);
  console.table(filtered.rows);
}

main().catch(console.error);
