import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

/**
 * Step 1: Setting up PGlite with pgvector
 * 
 * This example demonstrates:
 * 1. Initializing PGlite in-memory
 * 2. Enabling the pgvector extension
 * 3. Creating a table with a vector column
 */

async function main() {
  console.log('🚀 Initializing PGlite...');
  
  // Initialize PGlite (in-memory for this example)
  const db = new PGlite({
    extensions: { vector },
  });

  await db.waitReady;
  console.log('✅ PGlite is ready');

  // Step 1: Create the vector extension
  await db.exec('CREATE EXTENSION IF NOT EXISTS vector');
  console.log('✅ vector extension enabled');

  // Step 2: Create a documents table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      embedding vector(3) -- A small vector for demonstration
    );
  `);
  console.log('✅ documents table created');

  // Step 3: Insert some sample data
  console.log('📥 Inserting sample documents...');
  await db.query(`
    INSERT INTO documents (content, embedding) VALUES 
    ('The cat is on the mat', '[0.1, 0.2, 0.3]'),
    ('The dog is in the yard', '[0.4, 0.5, 0.6]'),
    ('Fish swim in the ocean', '[0.7, 0.8, 0.9]');
  `);

  // Step 4: Query the data
  const result = await db.query('SELECT * FROM documents');
  console.log('\n📊 Database Contents:');
  console.table(result.rows);

  // Step 5: Perform a simple similarity search (L2 distance)
  console.log('\n🔎 Searching for closest to [0.1, 0.2, 0.2]...');
  const searchResult = await db.query(`
    SELECT content, embedding <-> '[0.1, 0.2, 0.2]' as distance
    FROM documents
    ORDER BY distance ASC
    LIMIT 1;
  `);
  
  console.log('Best match:', searchResult.rows[0]);
}

main().catch(console.error);
