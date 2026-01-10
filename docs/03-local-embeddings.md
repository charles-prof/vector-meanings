# Step 3: Generating Embeddings Locally with Transformers.js

> 🎯 **Duration**: 20 minutes | **Difficulty**: Intermediate

## Overview

In this step, you'll learn how to generate vector embeddings **entirely on-device** using **Transformers.js**. No API calls, no data leaving your machine—just pure local inference.

---

## What is Transformers.js?

**Transformers.js** is a JavaScript library that brings Hugging Face's transformer models to the browser and Node.js. It supports:

- 🧠 **Text embeddings** (our focus)
- 🖼️ **Image classification**
- 🗣️ **Speech recognition**
- 📝 **Text generation**

### Key Features

| Feature | Description |
|---------|-------------|
| WebAssembly Backend | Runs on any modern browser |
| WebGPU Support | Hardware acceleration when available |
| Model Caching | Downloads once, runs offline |
| Quantized Models | Smaller, faster versions available |

---

## The Embedding Pipeline

Here's how we'll generate embeddings:

```
                    Transformers.js
┌──────────┐     ┌──────────────────┐     ┌──────────────┐
│   Text   │ ──▶ │   Tokenizer      │ ──▶ │    Model     │ ──▶ [0.1, -0.5, ...]
│  Input   │     │   (Text→Tokens)  │     │  (Tokens→Vec)│     (384 dimensions)
└──────────┘     └──────────────────┘     └──────────────┘
                         │                        │
                         ▼                        ▼
              "I love coding" ───▶ [101, 1045, 2293, ...] ───▶ [0.1, -0.5, ...]
```

---

## Setting Up Transformers.js

### Installation

```bash
npm install @huggingface/transformers
```

### Model Selection

For this course, we'll use **all-MiniLM-L6-v2**:

| Property | Value |
|----------|-------|
| Model ID | `Xenova/all-MiniLM-L6-v2` |
| Dimensions | 384 |
| Size | ~22MB (quantized) |
| Speed | ~50ms per sentence |
| Quality | Good for general purpose |

---

## Hands-On: Creating an Embedding Service

Let's build a robust embedding service with TypeScript:

### Project Structure

```
src/
├── lib/
│   ├── embeddings.ts    # Main embedding service
│   └── types.ts         # Type definitions
└── index.ts             # Usage example
```

### Type Definitions

```typescript
// src/lib/types.ts

/**
 * Configuration for the embedding service
 */
export interface EmbeddingConfig {
  /** Hugging Face model ID */
  modelId: string;
  
  /** Number of dimensions in the output vectors */
  dimensions: number;
  
  /** Maximum number of tokens per input */
  maxTokens: number;
  
  /** Whether to normalize output vectors */
  normalize: boolean;
}

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  /** The original input text */
  text: string;
  
  /** The generated embedding vector */
  embedding: number[];
  
  /** Number of tokens in the input */
  tokenCount: number;
  
  /** Time taken to generate (ms) */
  duration: number;
}

/**
 * Batch embedding result with statistics
 */
export interface BatchEmbeddingResult {
  /** Individual results */
  results: EmbeddingResult[];
  
  /** Total processing time (ms) */
  totalDuration: number;
  
  /** Average time per text (ms) */
  averageTime: number;
}
```

### The Embedding Service

```typescript
// src/lib/embeddings.ts

import { pipeline, FeatureExtractionPipeline, env } from '@huggingface/transformers';
import { EmbeddingConfig, EmbeddingResult, BatchEmbeddingResult } from './types';

/**
 * Default embedding configuration using MiniLM
 */
const DEFAULT_CONFIG: EmbeddingConfig = {
  modelId: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
  maxTokens: 256,
  normalize: true,
};

/**
 * Embedding service for generating text embeddings locally
 * 
 * @example
 * ```typescript
 * const service = new EmbeddingService();
 * await service.initialize();
 * 
 * const result = await service.embed("Hello, world!");
 * console.log(result.embedding); // [0.1, -0.2, ...]
 * ```
 */
export class EmbeddingService {
  private config: EmbeddingConfig;
  private pipeline: FeatureExtractionPipeline | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Enable caching to avoid re-downloading the model
    env.cacheDir = './.cache';
    env.allowLocalModels = true;
  }

  /**
   * Initialize the embedding pipeline
   * Downloads the model on first run (~22MB for MiniLM)
   * 
   * @param onProgress - Optional callback for download progress
   */
  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return;
    }

    this.initializationPromise = this.doInitialize(onProgress);
    await this.initializationPromise;
  }

  private async doInitialize(onProgress?: (progress: number) => void): Promise<void> {
    console.log(`🚀 Loading embedding model: ${this.config.modelId}`);
    const startTime = performance.now();

    try {
      this.pipeline = await pipeline('feature-extraction', this.config.modelId, {
        progress_callback: (progressInfo: { progress?: number }) => {
          if (progressInfo.progress !== undefined && onProgress) {
            onProgress(progressInfo.progress);
          }
        },
      });

      this.isInitialized = true;
      const duration = Math.round(performance.now() - startTime);
      console.log(`✅ Model loaded in ${duration}ms`);
    } catch (error) {
      console.error('❌ Failed to load embedding model:', error);
      throw new Error(`Failed to initialize embedding service: ${error}`);
    }
  }

  /**
   * Generate embedding for a single text
   * 
   * @param text - The text to embed
   * @returns Embedding result with vector and metadata
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.isInitialized || !this.pipeline) {
      throw new Error('Embedding service not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    // Run feature extraction
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: this.config.normalize,
    });

    // Extract the embedding array
    const embedding = Array.from(output.data as Float32Array);

    return {
      text,
      embedding,
      tokenCount: Math.ceil(text.split(/\s+/).length * 1.3), // Rough estimate
      duration: Math.round(performance.now() - startTime),
    };
  }

  /**
   * Generate embeddings for multiple texts
   * Processes in batches for efficiency
   * 
   * @param texts - Array of texts to embed
   * @param batchSize - Number of texts to process at once (default: 8)
   * @param onProgress - Optional callback for batch progress
   * @returns Batch result with all embeddings and statistics
   */
  async embedBatch(
    texts: string[],
    batchSize = 8,
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchEmbeddingResult> {
    const startTime = performance.now();
    const results: EmbeddingResult[] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Process each text in the batch
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text))
      );
      
      results.push(...batchResults);
      
      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + batchSize, texts.length), texts.length);
      }
    }

    const totalDuration = Math.round(performance.now() - startTime);

    return {
      results,
      totalDuration,
      averageTime: Math.round(totalDuration / texts.length),
    };
  }

  /**
   * Get the embedding dimension
   */
  get dimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Check if the service is ready
   */
  get ready(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the model ID being used
   */
  get modelId(): string {
    return this.config.modelId;
  }
}

/**
 * Create a singleton embedding service instance
 */
let defaultService: EmbeddingService | null = null;

export function getEmbeddingService(config?: Partial<EmbeddingConfig>): EmbeddingService {
  if (!defaultService) {
    defaultService = new EmbeddingService(config);
  }
  return defaultService;
}
```

---

## Using the Embedding Service

### Basic Usage

```typescript
// src/index.ts

import { EmbeddingService } from './lib/embeddings';

async function main() {
  // Create and initialize the service
  const embeddingService = new EmbeddingService();
  
  console.log('📥 Downloading model (first run only)...');
  await embeddingService.initialize((progress) => {
    process.stdout.write(`\r   Progress: ${progress.toFixed(1)}%`);
  });
  console.log('\n');

  // Generate a single embedding
  const result = await embeddingService.embed('Machine learning is fascinating!');
  
  console.log('📊 Embedding Result:');
  console.log(`   Text: "${result.text}"`);
  console.log(`   Dimensions: ${result.embedding.length}`);
  console.log(`   First 5 values: [${result.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
  console.log(`   Duration: ${result.duration}ms`);
}

main();
```

### Batch Processing

```typescript
// src/batch-example.ts

import { EmbeddingService } from './lib/embeddings';

async function processBatch() {
  const embeddingService = new EmbeddingService();
  await embeddingService.initialize();

  const documents = [
    'JavaScript is a programming language.',
    'Python is great for machine learning.',
    'TypeScript adds types to JavaScript.',
    'Rust is known for memory safety.',
    'Go is designed for simplicity.',
  ];

  console.log(`\n📦 Processing ${documents.length} documents...\n`);

  const batchResult = await embeddingService.embedBatch(
    documents,
    4, // batch size
    (completed, total) => {
      const percent = Math.round((completed / total) * 100);
      console.log(`   Progress: ${completed}/${total} (${percent}%)`);
    }
  );

  console.log('\n📊 Batch Results:');
  console.log(`   Total time: ${batchResult.totalDuration}ms`);
  console.log(`   Average time per document: ${batchResult.averageTime}ms`);

  // Show first result
  const first = batchResult.results[0];
  console.log(`\n   First document: "${first.text}"`);
  console.log(`   Embedding preview: [${first.embedding.slice(0, 3).map(v => v.toFixed(3)).join(', ')}...]`);
}

processBatch();
```

---

## Measuring Semantic Similarity

Let's combine embeddings with similarity calculations:

```typescript
// src/similarity-demo.ts

import { EmbeddingService } from './lib/embeddings';
import { cosineSimilarity } from './lib/embedding-explorer';

async function demo() {
  const embeddingService = new EmbeddingService();
  await embeddingService.initialize();

  // Define test sentences
  const sentences = [
    'I love programming in TypeScript',
    'Coding in JavaScript is fun',
    'The weather is beautiful today',
    'It is sunny outside',
    'Machine learning uses neural networks',
  ];

  console.log('\n🧠 Generating embeddings for all sentences...\n');

  // Generate embeddings for all sentences
  const embeddings = await Promise.all(
    sentences.map(async (text) => ({
      text,
      embedding: (await embeddingService.embed(text)).embedding,
    }))
  );

  // Calculate and display similarity matrix
  console.log('📊 Similarity Matrix:\n');
  console.log('     | S1    S2    S3    S4    S5');
  console.log('-----|' + '-'.repeat(30));

  for (let i = 0; i < embeddings.length; i++) {
    let row = `  S${i + 1} |`;
    for (let j = 0; j < embeddings.length; j++) {
      const sim = cosineSimilarity(
        embeddings[i].embedding,
        embeddings[j].embedding
      );
      row += ` ${sim.toFixed(2)} `;
    }
    console.log(row);
    console.log(`      "${sentences[i].substring(0, 40)}..."`);
    console.log('');
  }

  // Find the most similar pair (excluding self-similarity)
  let maxSim = -1;
  let maxPair: [number, number] = [0, 0];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(
        embeddings[i].embedding,
        embeddings[j].embedding
      );
      if (sim > maxSim) {
        maxSim = sim;
        maxPair = [i, j];
      }
    }
  }

  console.log('\n🎯 Most Similar Pair:');
  console.log(`   "${sentences[maxPair[0]]}"`);
  console.log(`   "${sentences[maxPair[1]]}"`);
  console.log(`   Similarity: ${(maxSim * 100).toFixed(1)}%`);
}

demo();
```

---

## Performance Optimization

### WebGPU Acceleration

If WebGPU is available, Transformers.js can use GPU acceleration:

```typescript
import { env } from '@huggingface/transformers';

// Enable WebGPU if available
env.backends.onnx.wasm.proxy = true;

// Check for WebGPU support
if ('gpu' in navigator) {
  console.log('🚀 WebGPU available - using GPU acceleration');
}
```

### Using Quantized Models

Quantized models are smaller and faster:

```typescript
const embeddingService = new EmbeddingService({
  modelId: 'Xenova/all-MiniLM-L6-v2', // Already optimized
  // Explicit quantization (if needed):
  // quantized: true,
});
```

### Web Workers

For browser applications, run embedding in a Web Worker to avoid blocking the main thread:

```typescript
// embedding.worker.ts
import { EmbeddingService } from './lib/embeddings';

let service: EmbeddingService;

self.onmessage = async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'INITIALIZE':
      service = new EmbeddingService(data.config);
      await service.initialize();
      self.postMessage({ type: 'INITIALIZED' });
      break;

    case 'EMBED':
      const result = await service.embed(data.text);
      self.postMessage({ type: 'EMBEDDED', data: result });
      break;

    case 'EMBED_BATCH':
      const batchResult = await service.embedBatch(data.texts);
      self.postMessage({ type: 'BATCH_EMBEDDED', data: batchResult });
      break;
  }
};
```

---

## 🎯 Exercise: Find Similar Texts

Write a function that takes a query and a list of documents, generates embeddings for all, and returns the top 3 most similar documents:

```typescript
interface Document {
  id: string;
  content: string;
}

interface SearchResult {
  document: Document;
  similarity: number;
}

async function findSimilar(
  query: string,
  documents: Document[],
  topK: number = 3
): Promise<SearchResult[]> {
  // Your implementation here
}
```

<details>
<summary>✅ Solution</summary>

```typescript
import { EmbeddingService, getEmbeddingService } from './lib/embeddings';
import { cosineSimilarity } from './lib/embedding-explorer';

interface Document {
  id: string;
  content: string;
}

interface SearchResult {
  document: Document;
  similarity: number;
}

async function findSimilar(
  query: string,
  documents: Document[],
  topK: number = 3
): Promise<SearchResult[]> {
  const service = getEmbeddingService();
  
  if (!service.ready) {
    await service.initialize();
  }

  // Generate query embedding
  const queryResult = await service.embed(query);

  // Generate document embeddings
  const docResults = await Promise.all(
    documents.map(async (doc) => ({
      document: doc,
      embedding: (await service.embed(doc.content)).embedding,
    }))
  );

  // Calculate similarities and sort
  const results = docResults
    .map(({ document, embedding }) => ({
      document,
      similarity: cosineSimilarity(queryResult.embedding, embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

// Usage
async function test() {
  const documents: Document[] = [
    { id: '1', content: 'TypeScript is a superset of JavaScript' },
    { id: '2', content: 'Python is great for data science' },
    { id: '3', content: 'React is a UI library for JavaScript' },
    { id: '4', content: 'Machine learning requires lots of data' },
  ];

  const results = await findSimilar(
    'I want to learn JavaScript programming',
    documents
  );

  console.log('🔍 Similar documents:');
  results.forEach(({ document, similarity }, i) => {
    console.log(`${i + 1}. [${(similarity * 100).toFixed(1)}%] ${document.content}`);
  });
}

test();
```

</details>

---

## ✅ Checkpoint

Before moving on, make sure you can:

- [ ] Install and configure Transformers.js
- [ ] Initialize an embedding model
- [ ] Generate embeddings for single texts
- [ ] Process batches of texts efficiently
- [ ] Calculate similarity between embeddings
- [ ] Understand performance optimization options

---

## Common Issues & Solutions

### "Out of Memory" Error

If processing many large documents:
- Reduce batch size
- Process in chunks
- Use a Web Worker

### Slow Model Loading

First run downloads the model (~22MB). Subsequent runs use the cached version. Ensure `.cache` directory is not being cleared.

### CORS Issues in Browser

If loading fails in browser, ensure the CDN allows CORS. HuggingFace CDN should work by default.

---

## What's Next?

Now that we can generate embeddings, let's build a complete document ingestion pipeline that chunks documents and prepares them for storage.

**[➡️ Continue to Step 4: Document Ingestion Pipeline](./04-document-ingestion.md)**

**[⬅️ Back to Step 2: Understanding Vector Embeddings](./02-vector-embeddings.md)**
