/**
 * Step 4: Document Ingestion and Chunking
 * 
 * This example demonstrates:
 * 1. Fixed-size chunking with overlap
 * 2. Recursive character-based chunking
 */

interface Chunk {
  content: string;
  index: number;
}

/**
 * Fixed-size chunking with overlap
 */
function fixedSizeChunk(text: string, size: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push({
      content: text.substring(start, end),
      index: index++
    });
    start += (size - overlap);
  }

  return chunks;
}

/**
 * Recursive chunking (simplified)
 */
function recursiveChunk(text: string, maxSize: number, separators = ['\n\n', '\n', ' ', '']): string[] {
  if (text.length <= maxSize) return [text];

  let separator = separators[0];
  for (const s of separators) {
    if (text.includes(s)) {
      separator = s;
      break;
    }
  }

  const parts = text.split(separator);
  const result: string[] = [];
  let current = '';

  for (const part of parts) {
    if ((current + part).length > maxSize) {
      if (current) result.push(current);
      current = part;
    } else {
      current += (current ? separator : '') + part;
    }
  }
  
  if (current) result.push(current);
  return result;
}

const sampleText = `
PGlite is a WASM-based PostgreSQL distribution. 
It allows you to run a full Postgres database in the browser or Node.js without any external dependencies.

One of the most powerful extensions for PostgreSQL is pgvector. 
It enables vector similarity search, which is essential for building AI applications like RAG.

Combining PGlite with pgvector gives you a high-performance local vector database.
Privacy, speed, and cost-efficiency are the main benefits of this approach.
`;

console.log('📄 Original Text Length:', sampleText.length);

console.log('\n📦 Fixed-Size Chunking (Size 50, Overlap 10):');
const fixedChunks = fixedSizeChunk(sampleText, 50, 10);
fixedChunks.forEach(c => console.log(`${c.index}: [${c.content.replace(/\n/g, ' ')}]`));

console.log('\n📦 Recursive Chunking (Max Size 100):');
const recursiveChunks = recursiveChunk(sampleText, 100);
recursiveChunks.forEach((c, i) => console.log(`${i}: [${c.replace(/\n/g, ' ')}]`));
