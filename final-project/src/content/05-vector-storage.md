# Step 5: Vector Storage and Indexing

> 🎯 **Duration**: 20 minutes | **Difficulty**: Intermediate

## Overview

Now that we can generate embeddings, we need to store them efficiently for fast retrieval. In this step, you'll learn how to:

- Store embeddings in PGlite with pgvector
- Create indexes for fast similarity search
- Choose the right index type for your use case
- Tune index parameters for optimal performance

---

## Storing Vectors in PGlite

### Table Schema Design

A well-designed schema stores both the content and embeddings with rich metadata:

```sql
CREATE TABLE documents (
  -- Primary key
  id SERIAL PRIMARY KEY,
  
  -- Chunk identification
  chunk_id TEXT UNIQUE NOT NULL,
  document_id TEXT NOT NULL,
  
  -- Content
  content TEXT NOT NULL,
  
  -- Vector embedding
  embedding vector(384),
  
  -- Metadata (flexible JSON)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast document lookups
CREATE INDEX idx_documents_document_id ON documents(document_id);

-- Index for metadata queries
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);
```

---

## Vector Index Types

pgvector supports two main index types for approximate nearest neighbor (ANN) search:

### 1. IVFFlat (Inverted File with Flat Compression)

Divides vectors into clusters (lists) and searches only the most promising clusters.

```
         Query Vector
              │
              ▼
        ┌─────────┐
        │ Compare │
        │ to all  │
        │centroids│
        └────┬────┘
             │
    ┌────────┼────────┐
    ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐
│List 1│ │List 2│ │List 3│  ← Only search top N lists
└──────┘ └──────┘ └──────┘
```

**Characteristics:**
| Aspect | IVFFlat |
|--------|---------|
| Build Speed | ⚡ Fast |
| Query Speed | 🔄 Medium |
| Memory | 📉 Lower |
| Accuracy | 🎯 Good (tunable) |
| Best For | Large datasets (>10k vectors) |

### 2. HNSW (Hierarchical Navigable Small World)

Builds a multi-layer graph for efficient navigation to nearest neighbors.

```
Layer 2:  ●───────────────────●
          │                   │
Layer 1:  ●─────●─────●───────●─────●
          │     │     │       │     │
Layer 0:  ●─●─●─●─●─●─●─●─●─●─●─●─●─●
                    ▲
               Query starts here
               and navigates up
```

**Characteristics:**
| Aspect | HNSW |
|--------|------|
| Build Speed | 🐢 Slower |
| Query Speed | ⚡ Fastest |
| Memory | 📈 Higher |
| Accuracy | 🎯 Excellent |
| Best For | High query performance needs |

### When to Use Each

| Scenario | Recommended Index |
|----------|------------------|
| < 1,000 vectors | No index (exact search) |
| 1,000 - 100,000 vectors | IVFFlat |
| > 100,000 vectors | HNSW |
| Memory constrained | IVFFlat |
| Query speed critical | HNSW |
| Frequent updates | IVFFlat (faster rebuild) |

---

## Hands-On: Building the Vector Store

### Project Structure

```
src/
├── lib/
│   ├── vector-store/
│   │   ├── index.ts           # Main vector store class
│   │   ├── types.ts           # Type definitions
│   │   └── queries.ts         # SQL query builders
│   └── ...
└── index.ts
```

### Type Definitions

```typescript
// src/lib/vector-store/types.ts

import { TextChunk } from '../chunking/types';

/**
 * A stored document with its embedding
 */
export interface StoredDocument {
  /** Database ID */
  id: number;
  
  /** Chunk ID (from ingestion) */
  chunkId: string;
  
  /** Parent document ID */
  documentId: string;
  
  /** Text content */
  content: string;
  
  /** Vector embedding (array of floats) */
  embedding: number[];
  
  /** Metadata JSON */
  metadata: Record<string, unknown>;
  
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Configuration for the vector store
 */
export interface VectorStoreConfig {
  /** Database name (for IndexedDB storage key) */
  databaseName: string;
  
  /** Table name for documents */
  tableName: string;
  
  /** Vector dimensions */
  dimensions: number;
  
  /** Index type to use */
  indexType: 'none' | 'ivfflat' | 'hnsw';
  
  /** IVFFlat specific: number of lists */
  ivfflatLists?: number;
  
  /** HNSW specific: max connections per node */
  hnswM?: number;
  
  /** HNSW specific: size of dynamic candidate list */
  hnswEfConstruction?: number;
}

/**
 * Result of a similarity search
 */
export interface SearchResult {
  /** The matching document */
  document: StoredDocument;
  
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
  
  /** Distance from query (lower is more similar) */
  distance: number;
}

/**
 * Default configuration
 */
export const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  databaseName: 'knowledge-base',
  tableName: 'documents',
  dimensions: 384,
  indexType: 'none', // Start without index, add when needed
  ivfflatLists: 100,
  hnswM: 16,
  hnswEfConstruction: 64,
};
```

### The Vector Store Implementation

```typescript
// src/lib/vector-store/index.ts

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { 
  VectorStoreConfig, 
  StoredDocument, 
  SearchResult,
  DEFAULT_VECTOR_STORE_CONFIG 
} from './types';
import { IngestedChunk } from '../ingestion';

/**
 * Vector store for managing document embeddings in PGlite
 * 
 * @example
 * ```typescript
 * const store = new VectorStore();
 * await store.initialize();
 * 
 * // Store chunks from ingestion
 * await store.addChunks(ingestedChunks);
 * 
 * // Search for similar content
 * const results = await store.search(queryEmbedding, 5);
 * ```
 */
export class VectorStore {
  private config: VectorStoreConfig;
  private db: PGlite | null = null;
  private isInitialized = false;

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = { ...DEFAULT_VECTOR_STORE_CONFIG, ...config };
  }

  /**
   * Initialize the vector store
   * Creates the database, tables, and indexes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🗄️  Initializing vector store...');

    // Create PGlite instance with vector extension
    this.db = new PGlite(`idb://${this.config.databaseName}`, {
      extensions: { vector },
    });

    await this.db.waitReady;

    // Enable vector extension
    await this.db.exec('CREATE EXTENSION IF NOT EXISTS vector');

    // Create documents table
    await this.createTable();

    // Create index if specified
    if (this.config.indexType !== 'none') {
      await this.createIndex();
    }

    this.isInitialized = true;
    console.log('✅ Vector store ready');
  }

  /**
   * Create the documents table
   */
  private async createTable(): Promise<void> {
    const { tableName, dimensions } = this.config;

    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        chunk_id TEXT UNIQUE NOT NULL,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(${dimensions}),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create supporting indexes
    await this.db!.exec(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_document_id 
      ON ${tableName}(document_id)
    `);

    await this.db!.exec(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_metadata 
      ON ${tableName} USING GIN(metadata)
    `);

    console.log(`   📋 Table "${tableName}" ready`);
  }

  /**
   * Create the vector index
   */
  private async createIndex(): Promise<void> {
    const { tableName, indexType, ivfflatLists, hnswM, hnswEfConstruction } = this.config;
    const indexName = `idx_${tableName}_embedding`;

    // Check if index already exists
    const existingIndex = await this.db!.query(`
      SELECT indexname FROM pg_indexes 
      WHERE indexname = $1
    `, [indexName]);

    if (existingIndex.rows.length > 0) {
      console.log(`   📊 Index "${indexName}" already exists`);
      return;
    }

    console.log(`   📊 Creating ${indexType.toUpperCase()} index...`);

    if (indexType === 'ivfflat') {
      await this.db!.exec(`
        CREATE INDEX ${indexName}
        ON ${tableName} 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = ${ivfflatLists})
      `);
    } else if (indexType === 'hnsw') {
      await this.db!.exec(`
        CREATE INDEX ${indexName}
        ON ${tableName}
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = ${hnswM}, ef_construction = ${hnswEfConstruction})
      `);
    }

    console.log(`   ✅ Index "${indexName}" created`);
  }

  /**
   * Add a single chunk with its embedding
   */
  async addChunk(chunk: IngestedChunk): Promise<number> {
    this.ensureInitialized();

    const result = await this.db!.query(`
      INSERT INTO ${this.config.tableName} 
        (chunk_id, document_id, content, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (chunk_id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      chunk.chunk.id,
      chunk.chunk.metadata.documentId,
      chunk.chunk.content,
      JSON.stringify(chunk.embedding),
      JSON.stringify(chunk.chunk.metadata),
    ]);

    return (result.rows[0] as { id: number }).id;
  }

  /**
   * Add multiple chunks in a batch
   */
  async addChunks(
    chunks: IngestedChunk[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[]> {
    this.ensureInitialized();

    const ids: number[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const id = await this.addChunk(chunks[i]);
      ids.push(id);

      if (onProgress) {
        onProgress(i + 1, chunks.length);
      }
    }

    return ids;
  }

  /**
   * Search for similar documents using vector similarity
   * 
   * @param queryEmbedding - The query vector
   * @param limit - Maximum number of results
   * @param threshold - Minimum similarity threshold (0-1)
   * @returns Array of search results sorted by similarity
   */
  async search(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    // Using cosine distance (<=>) and converting to similarity
    const result = await this.db!.query(`
      SELECT 
        id,
        chunk_id,
        document_id,
        content,
        metadata,
        created_at,
        embedding <=> $1 as distance,
        1 - (embedding <=> $1) as similarity
      FROM ${this.config.tableName}
      WHERE 1 - (embedding <=> $1) >= $2
      ORDER BY embedding <=> $1
      LIMIT $3
    `, [
      JSON.stringify(queryEmbedding),
      threshold,
      limit,
    ]);

    return result.rows.map((row: any) => ({
      document: {
        id: row.id,
        chunkId: row.chunk_id,
        documentId: row.document_id,
        content: row.content,
        embedding: [], // Don't return embedding for performance
        metadata: row.metadata,
        createdAt: new Date(row.created_at),
      },
      similarity: row.similarity,
      distance: row.distance,
    }));
  }

  /**
   * Search with metadata filters
   */
  async searchWithFilter(
    queryEmbedding: number[],
    filter: Record<string, unknown>,
    limit: number = 5
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    const result = await this.db!.query(`
      SELECT 
        id,
        chunk_id,
        document_id,
        content,
        metadata,
        created_at,
        embedding <=> $1 as distance,
        1 - (embedding <=> $1) as similarity
      FROM ${this.config.tableName}
      WHERE metadata @> $2
      ORDER BY embedding <=> $1
      LIMIT $3
    `, [
      JSON.stringify(queryEmbedding),
      JSON.stringify(filter),
      limit,
    ]);

    return result.rows.map((row: any) => ({
      document: {
        id: row.id,
        chunkId: row.chunk_id,
        documentId: row.document_id,
        content: row.content,
        embedding: [],
        metadata: row.metadata,
        createdAt: new Date(row.created_at),
      },
      similarity: row.similarity,
      distance: row.distance,
    }));
  }

  /**
   * Delete a document and all its chunks
   */
  async deleteDocument(documentId: string): Promise<number> {
    this.ensureInitialized();

    const result = await this.db!.query(`
      DELETE FROM ${this.config.tableName}
      WHERE document_id = $1
      RETURNING id
    `, [documentId]);

    return result.rows.length;
  }

  /**
   * Get document count
   */
  async count(): Promise<number> {
    this.ensureInitialized();

    const result = await this.db!.query(`
      SELECT COUNT(*) as count FROM ${this.config.tableName}
    `);

    return parseInt((result.rows[0] as { count: string }).count, 10);
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    await this.db!.exec(`TRUNCATE TABLE ${this.config.tableName}`);
    console.log('🗑️  All documents cleared');
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('🔌 Vector store connection closed');
    }
  }

  /**
   * Ensure the store is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
let defaultStore: VectorStore | null = null;

export function getVectorStore(config?: Partial<VectorStoreConfig>): VectorStore {
  if (!defaultStore) {
    defaultStore = new VectorStore(config);
  }
  return defaultStore;
}
```

---

## Using the Vector Store

### Complete Example

```typescript
// src/demo-storage.ts

import { IngestionPipeline, Document } from './lib/ingestion';
import { VectorStore } from './lib/vector-store';
import { EmbeddingService } from './lib/embeddings';

async function main() {
  // Initialize services
  const embeddingService = new EmbeddingService();
  const pipeline = new IngestionPipeline();
  const vectorStore = new VectorStore({
    indexType: 'ivfflat',
    ivfflatLists: 10, // Small for demo
  });

  console.log('🚀 Initializing services...\n');
  await embeddingService.initialize();
  await pipeline.initialize();
  await vectorStore.initialize();

  // Sample documents
  const documents: Document[] = [
    {
      id: 'js-basics',
      title: 'JavaScript Basics',
      content: `
        JavaScript is a versatile programming language primarily used for 
        web development. It enables interactive web pages and is an 
        essential part of web applications. JavaScript can run in browsers 
        and on servers using Node.js.
        
        Key features include dynamic typing, prototype-based object 
        orientation, and first-class functions. It supports multiple 
        programming paradigms including event-driven and functional 
        programming styles.
      `,
    },
    {
      id: 'python-ml',
      title: 'Python for Machine Learning',
      content: `
        Python has become the dominant language for machine learning and 
        data science. Libraries like TensorFlow, PyTorch, and scikit-learn 
        provide powerful tools for building ML models.
        
        Python's simple syntax and extensive ecosystem make it ideal for 
        rapid prototyping and research. NumPy and Pandas provide efficient 
        data manipulation capabilities essential for ML workflows.
      `,
    },
    {
      id: 'react-intro',
      title: 'Introduction to React',
      content: `
        React is a JavaScript library for building user interfaces. 
        Developed by Facebook, it uses a component-based architecture 
        that promotes reusable UI elements.
        
        Key concepts include JSX syntax, virtual DOM for efficient updates,
        and hooks for managing state and side effects. React's declarative 
        approach makes it easier to reason about your application's behavior.
      `,
    },
  ];

  // Ingest and store documents
  console.log('📥 Ingesting and storing documents...\n');

  for (const doc of documents) {
    const result = await pipeline.ingest(doc);
    
    await vectorStore.addChunks(result.chunks, (done, total) => {
      process.stdout.write(`\r   Storing ${doc.id}: ${done}/${total} chunks`);
    });
    
    console.log(`\n   ✅ ${doc.id}: ${result.chunks.length} chunks stored`);
  }

  const totalCount = await vectorStore.count();
  console.log(`\n📊 Total chunks in store: ${totalCount}\n`);

  // Search for similar content
  const queries = [
    'How do I build interactive web pages?',
    'What are the best tools for deep learning?',
    'Tell me about component-based UI development',
  ];

  console.log('🔍 Running similarity searches...\n');

  for (const query of queries) {
    console.log(`   Query: "${query}"`);
    
    // Generate query embedding
    const queryResult = await embeddingService.embed(query);
    
    // Search
    const results = await vectorStore.search(queryResult.embedding, 2);
    
    console.log('   Results:');
    for (const result of results) {
      const preview = result.document.content.substring(0, 80).replace(/\n/g, ' ');
      console.log(`     ${(result.similarity * 100).toFixed(1)}% - ${preview}...`);
    }
    console.log('');
  }

  // Clean up
  await vectorStore.close();
  console.log('✅ Demo complete!');
}

main();
```

---

## Index Tuning

### IVFFlat Tuning

```sql
-- Set probes (number of lists to search)
-- Higher = more accurate but slower
SET ivfflat.probes = 10;

-- Rule of thumb for lists:
-- sqrt(n) for n < 1 million vectors
-- sqrt(n)/2 to sqrt(n) for larger datasets
```

### HNSW Tuning

```sql
-- Set ef_search (dynamic candidate list size)
-- Higher = more accurate but slower
SET hnsw.ef_search = 40;

-- m parameter (during index creation):
-- 16 is good default, increase for higher dimensions
-- ef_construction: 64-128 for good build quality
```

---

## 🎯 Exercise: Implement Hybrid Search

Create a hybrid search that combines vector similarity with keyword matching:

```typescript
async function hybridSearch(
  queryEmbedding: number[],
  keywords: string[],
  limit: number
): Promise<SearchResult[]> {
  // Combine vector similarity with keyword matching
}
```

<details>
<summary>✅ Solution</summary>

```typescript
async function hybridSearch(
  vectorStore: VectorStore,
  queryEmbedding: number[],
  keywords: string[],
  limit: number = 5
): Promise<SearchResult[]> {
  // Build keyword filter with ILIKE for case-insensitive matching
  const keywordConditions = keywords
    .map((_, i) => `content ILIKE $${i + 3}`)
    .join(' OR ');
  
  const keywordPatterns = keywords.map(k => `%${k}%`);

  const result = await vectorStore['db']!.query(`
    WITH vector_results AS (
      SELECT 
        id, chunk_id, document_id, content, metadata, created_at,
        1 - (embedding <=> $1) as vector_score
      FROM documents
      ORDER BY embedding <=> $1
      LIMIT $2 * 2
    ),
    keyword_results AS (
      SELECT 
        *,
        CASE WHEN ${keywordConditions} THEN 0.1 ELSE 0 END as keyword_boost
      FROM vector_results
    )
    SELECT 
      *,
      vector_score + keyword_boost as combined_score
    FROM keyword_results
    ORDER BY combined_score DESC
    LIMIT $2
  `, [JSON.stringify(queryEmbedding), limit, ...keywordPatterns]);

  return result.rows.map((row: any) => ({
    document: {
      id: row.id,
      chunkId: row.chunk_id,
      documentId: row.document_id,
      content: row.content,
      embedding: [],
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
    },
    similarity: row.combined_score,
    distance: 1 - row.vector_score,
  }));
}
```

</details>

---

## ✅ Checkpoint

Before moving on, make sure you can:

- [ ] Design a schema for storing vectors with metadata
- [ ] Choose between IVFFlat and HNSW indexes
- [ ] Store and retrieve documents with embeddings
- [ ] Perform similarity search with thresholds
- [ ] Filter results using metadata

---

## What's Next?

We can now store and search vectors efficiently. In the next step, we'll build a complete semantic search feature with ranking and relevance scoring.

**[➡️ Continue to Step 6: Semantic Search](./06-semantic-search.md)**

**[⬅️ Back to Step 4: Document Ingestion](./04-document-ingestion.md)**
