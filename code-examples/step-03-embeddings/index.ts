import { pipeline } from '@huggingface/transformers';

/**
 * Step 3: Generating Embeddings Locally with Transformers.js
 * 
 * This example demonstrates:
 * 1. Loading a feature extraction pipeline
 * 2. Generating embeddings for text
 * 3. Comparing two sentences using cosine similarity
 */

async function main() {
  console.log('🤖 Loading embedding model (Xenova/all-MiniLM-L6-v2)...');
  
  // Initialize the pipeline
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✅ Model loaded');

  const sentences = [
    'That is a happy person',
    'That is a very happy person',
    'That is a sad person'
  ];

  console.log('\n🧠 Generating embeddings...');
  
  const embeddings = await Promise.all(sentences.map(async (text) => {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return {
      text,
      values: Array.from(output.data as Float32Array)
    };
  }));

  console.log(`Generated ${embeddings.length} embeddings of dimension ${embeddings[0].values.length}`);

  // Calculate similarity between the first sentence and the others
  console.log('\n📊 Semantic Similarity (to "That is a happy person"):');
  
  const base = embeddings[0].values;
  
  embeddings.forEach((emb, i) => {
    const similarity = cosineSimilarity(base, emb.values);
    console.log(`${emb.text.padEnd(30)} | Score: ${similarity.toFixed(4)}`);
  });
}

/**
 * Simple cosine similarity helper
 */
function cosineSimilarity(v1: number[], v2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    norm1 += v1[i] * v1[i];
    norm2 += v2[i] * v2[i];
  }
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

main().catch(console.error);
