import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { pipeline } from '@huggingface/transformers';

/**
 * Step 7: Complete RAG Pipeline Example
 * 
 * This standalone script demonstrates the full flow:
 * 1. Initialize PGlite Vector DB
 * 2. Load Embedding Model
 * 3. Ingest and Vectorize documents
 * 4. Perform Semantic Search
 * 5. Construct a prompt for RAG
 */

async function main() {
  // 1. Setup
  console.log('🚀 Initializing services...');
  const db = new PGlite({ extensions: { vector } });
  await db.waitReady;
  await db.exec('CREATE EXTENSION IF NOT EXISTS vector');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id SERIAL PRIMARY KEY,
      content TEXT,
      embedding vector(384)
    )
  `);

  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✅ Services ready');

  // 2. Ingestion
  const documents = [
    'The solar system consists of the Sun and everything that orbits it.',
    'Jupiter is the largest planet in our solar system.',
    'Mars is known as the Red Planet due to iron oxide on its surface.',
    'The Earth is the third planet from the Sun and the only known to harbor life.'
  ];

  console.log('\n📥 Ingesting knowledge...');
  for (const doc of documents) {
    const output = await extractor(doc, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    
    await db.query(
      'INSERT INTO knowledge (content, embedding) VALUES ($1, $2)',
      [doc, JSON.stringify(embedding)]
    );
    console.log(`   Indexed: ${doc.substring(0, 40)}...`);
  }

  // 3. Retrieval
  const userQuery = 'What is the biggest planet?';
  console.log(`\n❓ User Query: "${userQuery}"`);
  
  console.log('🔍 Retrieving relevant context...');
  const queryOutput = await extractor(userQuery, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(queryOutput.data as Float32Array);

  const searchResults = await db.query(`
    SELECT content, 1 - (embedding <=> $1) as similarity
    FROM knowledge
    ORDER BY similarity DESC
    LIMIT 2
  `, [JSON.stringify(queryEmbedding)]);

  const context = (searchResults.rows as any[]).map(r => r.content).join('\n');
  console.log('✅ Context found:', context);

  // 4. Prompt Construction (RAG)
  console.log('\n💬 Prompt for LLM:');
  const prompt = `
Answer the following question using ONLY the provided context.

Context:
${context}

Question: ${userQuery}

Answer:`;
  
  console.log('-----------------------------------');
  console.log(prompt);
  console.log('-----------------------------------');
  
  console.log('\n✨ In a real application, you would now send this prompt to an LLM like Llama 3.');
}

main().catch(console.error);
