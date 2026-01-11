# Step 8: Performance Optimization

> 🎯 **Duration**: 20 minutes | **Difficulty**: Advanced

## Overview

In this final step, you'll learn techniques to optimize your RAG pipeline for production use:

- Caching strategies for embeddings
- Web Workers for non-blocking operations
- Lazy loading and progressive enhancement
- Memory management for large datasets
- Benchmarking and monitoring

---

## Optimization Strategies Overview

| Strategy | Impact | Complexity | When to Use |
|----------|--------|------------|-------------|
| Embedding Cache | ⚡⚡⚡ | Low | Always |
| Web Workers | ⚡⚡ | Medium | Browser apps |
| Batch Processing | ⚡⚡ | Low | Ingestion |
| Index Tuning | ⚡⚡ | Medium | Large datasets |
| Lazy Loading | ⚡ | Low | Initial load |
| Memory Pooling | ⚡ | High | Very large datasets |

---

## 1. Embedding Cache

Avoid regenerating embeddings for repeated queries:

```typescript
// src/lib/cache/embedding-cache.ts

interface CacheEntry {
  embedding: number[];
  timestamp: number;
  hits: number;
}

/**
 * LRU cache for embeddings
 * Prevents regenerating embeddings for the same text
 */
export class EmbeddingCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 3600000) { // 1 hour default TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate a cache key from text
   */
  private generateKey(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `emb_${hash}_${text.length}`;
  }

  /**
   * Get embedding from cache
   */
  get(text: string): number[] | null {
    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count and move to end (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.embedding;
  }

  /**
   * Store embedding in cache
   */
  set(text: string, embedding: number[]): void {
    const key = this.generateKey(text);

    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first key in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    let totalEntries = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalEntries++;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
    };
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
let embeddingCache: EmbeddingCache | null = null;

export function getEmbeddingCache(): EmbeddingCache {
  if (!embeddingCache) {
    embeddingCache = new EmbeddingCache();
  }
  return embeddingCache;
}
```

### Integrating the Cache

```typescript
// Modified EmbeddingService with caching

import { getEmbeddingCache } from '../cache/embedding-cache';

export class CachedEmbeddingService extends EmbeddingService {
  private cache = getEmbeddingCache();

  async embed(text: string): Promise<EmbeddingResult> {
    // Check cache first
    const cached = this.cache.get(text);
    if (cached) {
      return {
        text,
        embedding: cached,
        tokenCount: 0,
        duration: 0, // Instant from cache
      };
    }

    // Generate embedding
    const result = await super.embed(text);

    // Store in cache
    this.cache.set(text, result.embedding);

    return result;
  }
}
```

---

## 2. Web Workers

Move heavy operations off the main thread:

```typescript
// src/workers/embedding.worker.ts

import { EmbeddingService } from '../lib/embeddings';

let service: EmbeddingService | null = null;

/**
 * Web Worker for embedding generation
 * Runs in a separate thread to avoid blocking UI
 */
self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'INITIALIZE':
        service = new EmbeddingService(payload.config);
        await service.initialize((progress) => {
          self.postMessage({ type: 'PROGRESS', id, progress });
        });
        self.postMessage({ type: 'INITIALIZED', id });
        break;

      case 'EMBED':
        if (!service) {
          throw new Error('Service not initialized');
        }
        const result = await service.embed(payload.text);
        self.postMessage({ type: 'EMBEDDED', id, result });
        break;

      case 'EMBED_BATCH':
        if (!service) {
          throw new Error('Service not initialized');
        }
        const batchResult = await service.embedBatch(
          payload.texts,
          payload.batchSize,
          (completed, total) => {
            self.postMessage({ 
              type: 'BATCH_PROGRESS', 
              id, 
              completed, 
              total 
            });
          }
        );
        self.postMessage({ type: 'BATCH_EMBEDDED', id, result: batchResult });
        break;
    }
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
```

### Worker Wrapper

```typescript
// src/lib/workers/embedding-worker-wrapper.ts

import { EmbeddingResult, BatchEmbeddingResult, EmbeddingConfig } from '../embeddings';

/**
 * Wrapper class for the embedding worker
 * Provides a Promise-based API
 */
export class EmbeddingWorkerWrapper {
  private worker: Worker;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private requestId = 0;

  constructor() {
    this.worker = new Worker(
      new URL('./embedding.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event) => {
      const { type, id, result, error, progress, completed, total } = event.data;

      if (type === 'ERROR') {
        const request = this.pendingRequests.get(id);
        if (request) {
          request.reject(new Error(error));
          this.pendingRequests.delete(id);
        }
        return;
      }

      if (type === 'PROGRESS' || type === 'BATCH_PROGRESS') {
        // Handle progress callbacks separately
        return;
      }

      const request = this.pendingRequests.get(id);
      if (request) {
        request.resolve(result);
        this.pendingRequests.delete(id);
      }
    };
  }

  private nextId(): string {
    return `req_${++this.requestId}`;
  }

  async initialize(config?: Partial<EmbeddingConfig>): Promise<void> {
    const id = this.nextId();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'INITIALIZE', id, payload: { config } });
    });
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const id = this.nextId();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'EMBED', id, payload: { text } });
    });
  }

  async embedBatch(texts: string[], batchSize = 8): Promise<BatchEmbeddingResult> {
    const id = this.nextId();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ 
        type: 'EMBED_BATCH', 
        id, 
        payload: { texts, batchSize } 
      });
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}
```

---

## 3. Lazy Loading

Load resources only when needed:

```typescript
// src/lib/lazy-loader.ts

/**
 * Lazy-loaded module reference
 */
interface LazyModule<T> {
  load: () => Promise<T>;
  instance: T | null;
  loading: boolean;
}

/**
 * Create a lazy-loadable module
 */
export function createLazyModule<T>(loader: () => Promise<T>): LazyModule<T> {
  return {
    load: loader,
    instance: null,
    loading: false,
  };
}

/**
 * Get or load a lazy module
 */
export async function getLazyModule<T>(module: LazyModule<T>): Promise<T> {
  if (module.instance) {
    return module.instance;
  }

  if (module.loading) {
    // Wait for existing load to complete
    while (module.loading) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return module.instance!;
  }

  module.loading = true;
  try {
    module.instance = await module.load();
    return module.instance;
  } finally {
    module.loading = false;
  }
}

// Example: Lazy-loaded embedding service
export const lazyEmbeddingService = createLazyModule(async () => {
  const { EmbeddingService } = await import('./embeddings');
  const service = new EmbeddingService();
  await service.initialize();
  return service;
});

// Example: Lazy-loaded vector store
export const lazyVectorStore = createLazyModule(async () => {
  const { VectorStore } = await import('./vector-store');
  const store = new VectorStore();
  await store.initialize();
  return store;
});
```

---

## 4. Batch Processing Optimization

Process documents in optimal batches:

```typescript
// src/lib/optimization/batch-processor.ts

interface BatchConfig {
  /** Number of items per batch */
  batchSize: number;
  
  /** Delay between batches (ms) for rate limiting */
  batchDelay: number;
  
  /** Maximum concurrent operations */
  concurrency: number;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 10,
  batchDelay: 0,
  concurrency: 4,
};

/**
 * Process items in optimized batches
 */
export async function processBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: Partial<BatchConfig> = {},
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const { batchSize, batchDelay, concurrency } = { ...DEFAULT_BATCH_CONFIG, ...config };
  
  const results: R[] = [];
  let completed = 0;

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch with concurrency limit
    const batchResults = await processWithConcurrency(batch, processor, concurrency);
    results.push(...batchResults);
    
    completed += batch.length;
    if (onProgress) {
      onProgress(completed, items.length);
    }

    // Delay between batches if configured
    if (batchDelay > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  return results;
}

/**
 * Process items with concurrency limit
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    });

    executing.push(promise as unknown as Promise<void>);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      const completed = executing.filter(p => {
        // Check if promise is settled (hacky but works)
        let settled = false;
        p.then(() => { settled = true; }).catch(() => { settled = true; });
        return !settled;
      });
      executing.length = 0;
      executing.push(...completed);
    }
  }

  await Promise.all(executing);
  return results;
}
```

---

## 5. Memory Management

Handle large datasets without running out of memory:

```typescript
// src/lib/optimization/memory-manager.ts

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Monitor memory usage and apply pressure relief
 */
export class MemoryManager {
  private highWaterMark = 0.8; // 80% of heap limit

  /**
   * Get current memory statistics
   */
  getStats(): MemoryStats | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }
    return null;
  }

  /**
   * Check if memory pressure is high
   */
  isMemoryPressureHigh(): boolean {
    const stats = this.getStats();
    if (!stats) return false;
    
    return stats.usedJSHeapSize / stats.jsHeapSizeLimit > this.highWaterMark;
  }

  /**
   * Request garbage collection if available
   */
  requestGC(): void {
    if ('gc' in globalThis) {
      (globalThis as any).gc();
    }
  }

  /**
   * Process items with memory-aware batching
   */
  async processWithMemoryAwareness<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onPressure?: () => Promise<void>
  ): Promise<R[]> {
    const results: R[] = [];

    for (const item of items) {
      // Check memory pressure periodically
      if (this.isMemoryPressureHigh()) {
        console.warn('⚠️ High memory pressure detected');
        
        if (onPressure) {
          await onPressure();
        }
        
        this.requestGC();
        
        // Give time for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      results.push(await processor(item));
    }

    return results;
  }
}
```

---

## 6. Index Optimization

Tune pgvector indexes for your workload:

```typescript
// src/lib/optimization/index-tuner.ts

import { PGlite } from '@electric-sql/pglite';

interface IndexStats {
  rowCount: number;
  indexSize: string;
  scanTime: number;
}

/**
 * Analyze and optimize vector indexes
 */
export class IndexTuner {
  private db: PGlite;
  private tableName: string;

  constructor(db: PGlite, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Get current index statistics
   */
  async getStats(): Promise<IndexStats> {
    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    
    const sizeResult = await this.db.query(`
      SELECT pg_size_pretty(pg_total_relation_size('${this.tableName}')) as size
    `);

    // Benchmark a sample search
    const startTime = performance.now();
    await this.db.query(`
      SELECT id FROM ${this.tableName}
      ORDER BY embedding <=> '[${new Array(384).fill(0).join(',')}]'
      LIMIT 10
    `);
    const scanTime = performance.now() - startTime;

    return {
      rowCount: parseInt((countResult.rows[0] as any).count),
      indexSize: (sizeResult.rows[0] as any).size,
      scanTime: Math.round(scanTime),
    };
  }

  /**
   * Recommend index configuration based on data size
   */
  async recommendConfig(): Promise<{
    indexType: 'none' | 'ivfflat' | 'hnsw';
    params: Record<string, number>;
  }> {
    const stats = await this.getStats();
    
    if (stats.rowCount < 1000) {
      return {
        indexType: 'none',
        params: {},
      };
    }

    if (stats.rowCount < 100000) {
      return {
        indexType: 'ivfflat',
        params: {
          lists: Math.ceil(Math.sqrt(stats.rowCount)),
          probes: Math.ceil(Math.sqrt(stats.rowCount) / 10),
        },
      };
    }

    return {
      indexType: 'hnsw',
      params: {
        m: 16,
        ef_construction: 64,
        ef_search: 40,
      },
    };
  }

  /**
   * Apply recommended optimizations
   */
  async optimize(): Promise<void> {
    const recommendation = await this.recommendConfig();
    
    console.log(`📊 Recommended index: ${recommendation.indexType}`);
    console.log(`   Parameters:`, recommendation.params);

    // Apply the recommendation
    if (recommendation.indexType === 'none') {
      // Drop existing index if any
      await this.db.exec(`
        DROP INDEX IF EXISTS idx_${this.tableName}_embedding
      `);
    } else if (recommendation.indexType === 'ivfflat') {
      await this.db.exec(`
        DROP INDEX IF EXISTS idx_${this.tableName}_embedding;
        CREATE INDEX idx_${this.tableName}_embedding
        ON ${this.tableName}
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = ${recommendation.params.lists})
      `);
    } else if (recommendation.indexType === 'hnsw') {
      await this.db.exec(`
        DROP INDEX IF EXISTS idx_${this.tableName}_embedding;
        CREATE INDEX idx_${this.tableName}_embedding
        ON ${this.tableName}
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = ${recommendation.params.m}, ef_construction = ${recommendation.params.ef_construction})
      `);
    }

    console.log('✅ Optimization applied');
  }
}
```

---

## 7. Benchmarking

Measure and track performance:

```typescript
// src/lib/optimization/benchmark.ts

interface BenchmarkResult {
  name: string;
  samples: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Run a benchmark suite
 */
export async function benchmark(
  name: string,
  fn: () => Promise<void>,
  samples = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < 3; i++) {
    await fn();
  }

  // Measure
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);

  return {
    name,
    samples,
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    min: times[0],
    max: times[times.length - 1],
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
  };
}

/**
 * Print benchmark results
 */
export function printResults(results: BenchmarkResult[]): void {
  console.log('\n📊 Benchmark Results\n');
  console.log('Name                      Mean     Min      Max      P50      P95      P99');
  console.log('─'.repeat(85));

  for (const r of results) {
    console.log(
      `${r.name.padEnd(24)} ` +
      `${r.mean.toFixed(2).padStart(6)}ms ` +
      `${r.min.toFixed(2).padStart(6)}ms ` +
      `${r.max.toFixed(2).padStart(6)}ms ` +
      `${r.p50.toFixed(2).padStart(6)}ms ` +
      `${r.p95.toFixed(2).padStart(6)}ms ` +
      `${r.p99.toFixed(2).padStart(6)}ms`
    );
  }
}
```

### Running Benchmarks

```typescript
// src/benchmark-suite.ts

import { benchmark, printResults } from './lib/optimization/benchmark';
import { EmbeddingService } from './lib/embeddings';
import { VectorStore } from './lib/vector-store';

async function main() {
  const embeddingService = new EmbeddingService();
  const vectorStore = new VectorStore();

  await embeddingService.initialize();
  await vectorStore.initialize();

  const results = [];

  // Benchmark embedding generation
  results.push(await benchmark(
    'Single Embedding',
    async () => {
      await embeddingService.embed('This is a test sentence for benchmarking.');
    },
    50
  ));

  // Benchmark vector search
  const queryEmbedding = (await embeddingService.embed('test query')).embedding;
  
  results.push(await benchmark(
    'Vector Search (top 5)',
    async () => {
      await vectorStore.search(queryEmbedding, 5);
    },
    100
  ));

  results.push(await benchmark(
    'Vector Search (top 20)',
    async () => {
      await vectorStore.search(queryEmbedding, 20);
    },
    100
  ));

  printResults(results);
}

main();
```

---

## Performance Checklist

Before deploying to production, verify:

- [ ] **Embedding cache** is enabled and sized appropriately
- [ ] **Web Workers** are used for browser embedding generation
- [ ] **Batch sizes** are tuned for your hardware
- [ ] **Vector indexes** are created for datasets > 1,000 documents
- [ ] **Memory usage** stays below 80% during bulk operations
- [ ] **Query latency** meets your SLA (typically < 200ms for search)

---

## 🎯 Exercise: Implement Request Deduplication

Create a system that deduplicates concurrent requests for the same embedding:

```typescript
class RequestDeduplicator {
  async embed(text: string): Promise<number[]> {
    // If a request for the same text is already in progress,
    // return the same promise instead of starting a new one
  }
}
```

<details>
<summary>✅ Solution</summary>

```typescript
class RequestDeduplicator {
  private embeddingService: EmbeddingService;
  private inFlightRequests = new Map<string, Promise<number[]>>();

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  async embed(text: string): Promise<number[]> {
    // Check if request is already in flight
    const existing = this.inFlightRequests.get(text);
    if (existing) {
      return existing;
    }

    // Create new request
    const promise = this.embeddingService.embed(text)
      .then(result => {
        // Clean up after completion
        this.inFlightRequests.delete(text);
        return result.embedding;
      })
      .catch(error => {
        // Clean up on error too
        this.inFlightRequests.delete(text);
        throw error;
      });

    this.inFlightRequests.set(text, promise);
    return promise;
  }

  /**
   * Get number of requests currently in flight
   */
  get pendingCount(): number {
    return this.inFlightRequests.size;
  }
}
```

</details>

---

## ✅ Checkpoint

Congratulations! You've completed the course. Make sure you can:

- [ ] Implement embedding caching
- [ ] Use Web Workers for heavy operations
- [ ] Process documents in optimized batches
- [ ] Tune vector indexes for your workload
- [ ] Monitor memory usage
- [ ] Benchmark your pipeline

---

## Course Summary

You've learned how to build a complete, production-ready RAG pipeline that runs **entirely on-device**:

1. **PGlite + pgvector**: Local PostgreSQL with vector support
2. **Transformers.js**: On-device embedding generation
3. **Document Ingestion**: Chunking and processing pipelines
4. **Vector Storage**: Efficient storage with indexes
5. **Semantic Search**: Meaning-based retrieval
6. **RAG Pipeline**: Combining retrieval with generation
7. **Optimization**: Production-ready performance

---

## Next Steps

Now that you've completed the course, try building the **Final Project**:

**[🚀 Build the Local Knowledge Base App](../final-project/README.md)**

---

## Additional Resources

- [PGlite Documentation](https://pglite.dev/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [WebLLM for Local LLMs](https://webllm.mlc.ai/)
- [MTEB Benchmark](https://huggingface.co/spaces/mteb/leaderboard) - Compare embedding models

---

<p align="center">
  🎉 <strong>Congratulations on completing the course!</strong> 🎉
</p>

**[⬅️ Back to Step 7: RAG Pipeline](./07-rag-pipeline.md)**

**[🏠 Return to Course Home](../README.md)**
