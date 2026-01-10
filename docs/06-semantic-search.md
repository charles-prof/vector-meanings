# Step 6: Implementing Semantic Search

> 🎯 **Duration**: 20 minutes | **Difficulty**: Intermediate

## Overview

In this step, we'll build a complete **semantic search** system that understands the meaning behind queries, not just keywords. You'll learn to:

- Build a search service with ranking
- Implement context-aware retrieval
- Handle edge cases and improve relevance
- Create a user-friendly search API

---

## Semantic Search vs Keyword Search

| Aspect | Keyword Search | Semantic Search |
|--------|---------------|-----------------|
| Query | "python machine learning" | "How do I train AI models?" |
| Matching | Exact word matches | Meaning similarity |
| Synonyms | ❌ Misses | ✅ Understands |
| Context | ❌ Ignores | ✅ Considers |
| Typos | ❌ Fails | ✅ Robust |

### Example

Query: **"How do I create reactive user interfaces?"**

| Document | Keyword Match | Semantic Match |
|----------|--------------|----------------|
| "React is a JavaScript library for building UIs" | ❌ No exact match | ✅ 0.89 similarity |
| "creating reactive forms in Angular" | ⚠️ Partial | ✅ 0.85 similarity |
| "The user interface design principles" | ⚠️ Partial | ✅ 0.72 similarity |

---

## Building the Search Service

### Project Structure

```
src/
├── lib/
│   ├── search/
│   │   ├── index.ts           # Main search service
│   │   ├── types.ts           # Type definitions
│   │   ├── ranker.ts          # Result ranking utilities
│   │   └── context.ts         # Context window builder
│   └── ...
└── index.ts
```

### Type Definitions

```typescript
// src/lib/search/types.ts

import { StoredDocument } from '../vector-store/types';

/**
 * Search query with options
 */
export interface SearchQuery {
  /** The natural language query */
  text: string;
  
  /** Maximum number of results */
  limit?: number;
  
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  
  /** Metadata filters */
  filters?: Record<string, unknown>;
  
  /** Whether to include context window */
  includeContext?: boolean;
  
  /** Number of surrounding chunks to include */
  contextWindow?: number;
}

/**
 * Individual search result
 */
export interface SearchResultItem {
  /** The matching document chunk */
  document: StoredDocument;
  
  /** Similarity score (0-1) */
  score: number;
  
  /** Ranking position (1-indexed) */
  rank: number;
  
  /** Highlighted content (with query terms marked) */
  highlights?: string[];
  
  /** Context from surrounding chunks */
  context?: ContextWindow;
}

/**
 * Context window around a search result
 */
export interface ContextWindow {
  /** Chunks before the match */
  before: StoredDocument[];
  
  /** The matching chunk */
  match: StoredDocument;
  
  /** Chunks after the match */
  after: StoredDocument[];
  
  /** Combined context text */
  combinedText: string;
}

/**
 * Complete search response
 */
export interface SearchResponse {
  /** The original query */
  query: string;
  
  /** Search results */
  results: SearchResultItem[];
  
  /** Total number of matches (before limit) */
  totalMatches: number;
  
  /** Time taken to search (ms) */
  duration: number;
  
  /** Search metadata */
  metadata: {
    /** Whether any filters were applied */
    filtered: boolean;
    
    /** The similarity threshold used */
    threshold: number;
    
    /** Number of documents in the index */
    indexSize: number;
  };
}

/**
 * Default search options
 */
export const DEFAULT_SEARCH_OPTIONS = {
  limit: 5,
  threshold: 0.3,
  includeContext: false,
  contextWindow: 1,
};
```

### The Search Service

```typescript
// src/lib/search/index.ts

import { EmbeddingService, getEmbeddingService } from '../embeddings';
import { VectorStore, getVectorStore, SearchResult } from '../vector-store';
import { 
  SearchQuery, 
  SearchResponse, 
  SearchResultItem,
  ContextWindow,
  DEFAULT_SEARCH_OPTIONS 
} from './types';

/**
 * Semantic search service
 * Provides high-level search functionality with ranking and context
 * 
 * @example
 * ```typescript
 * const searchService = new SemanticSearchService();
 * await searchService.initialize();
 * 
 * const results = await searchService.search({
 *   text: "How do I build web applications?",
 *   limit: 5,
 * });
 * 
 * for (const result of results.results) {
 *   console.log(`${result.rank}. ${result.score.toFixed(2)} - ${result.document.content}`);
 * }
 * ```
 */
export class SemanticSearchService {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private isInitialized = false;

  constructor() {
    this.embeddingService = getEmbeddingService();
    this.vectorStore = getVectorStore();
  }

  /**
   * Initialize the search service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🔍 Initializing search service...');
    await this.embeddingService.initialize();
    await this.vectorStore.initialize();
    this.isInitialized = true;
    console.log('✅ Search service ready');
  }

  /**
   * Perform a semantic search
   * 
   * @param query - Search query with options
   * @returns Search response with ranked results
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    this.ensureInitialized();

    const startTime = performance.now();
    const options = { ...DEFAULT_SEARCH_OPTIONS, ...query };

    // Step 1: Generate query embedding
    const queryEmbedding = await this.embeddingService.embed(query.text);

    // Step 2: Search vector store
    let vectorResults: SearchResult[];
    
    if (options.filters && Object.keys(options.filters).length > 0) {
      vectorResults = await this.vectorStore.searchWithFilter(
        queryEmbedding.embedding,
        options.filters,
        options.limit * 2 // Get extra for re-ranking
      );
    } else {
      vectorResults = await this.vectorStore.search(
        queryEmbedding.embedding,
        options.limit * 2,
        options.threshold
      );
    }

    // Step 3: Filter by threshold
    const filteredResults = vectorResults.filter(
      r => r.similarity >= options.threshold
    );

    // Step 4: Apply limit and rank
    const rankedResults = filteredResults
      .slice(0, options.limit)
      .map((result, index) => ({
        document: result.document,
        score: result.similarity,
        rank: index + 1,
        highlights: this.extractHighlights(result.document.content, query.text),
      }));

    // Step 5: Add context if requested
    const resultsWithContext: SearchResultItem[] = options.includeContext
      ? await Promise.all(
          rankedResults.map(async (result) => ({
            ...result,
            context: await this.getContextWindow(
              result.document,
              options.contextWindow
            ),
          }))
        )
      : rankedResults;

    const duration = Math.round(performance.now() - startTime);
    const indexSize = await this.vectorStore.count();

    return {
      query: query.text,
      results: resultsWithContext,
      totalMatches: filteredResults.length,
      duration,
      metadata: {
        filtered: !!(options.filters && Object.keys(options.filters).length > 0),
        threshold: options.threshold,
        indexSize,
      },
    };
  }

  /**
   * Search and return combined context for RAG
   * 
   * @param query - The search query text
   * @param maxTokens - Maximum tokens to return (approximate)
   * @returns Combined context string
   */
  async searchForContext(query: string, maxTokens: number = 2000): Promise<string> {
    const results = await this.search({
      text: query,
      limit: 10,
      threshold: 0.3,
    });

    // Combine results up to maxTokens
    const chunks: string[] = [];
    let estimatedTokens = 0;

    for (const result of results.results) {
      const chunkTokens = Math.ceil(result.document.content.length / 4);
      
      if (estimatedTokens + chunkTokens > maxTokens) {
        break;
      }

      chunks.push(result.document.content);
      estimatedTokens += chunkTokens;
    }

    return chunks.join('\n\n---\n\n');
  }

  /**
   * Extract highlighted snippets from content
   */
  private extractHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const sentences = content.split(/[.!?]+/);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const matchCount = queryWords.filter(word => 
        lowerSentence.includes(word)
      ).length;

      if (matchCount > 0) {
        const trimmed = sentence.trim();
        if (trimmed.length > 20 && trimmed.length < 200) {
          highlights.push(trimmed);
        }
      }
    }

    return highlights.slice(0, 3);
  }

  /**
   * Get context window around a chunk
   */
  private async getContextWindow(
    document: StoredDocument,
    windowSize: number
  ): Promise<ContextWindow> {
    // Get chunks from the same document
    const allChunks = await this.vectorStore['db']!.query(`
      SELECT id, chunk_id, document_id, content, metadata, created_at
      FROM documents
      WHERE document_id = $1
      ORDER BY (metadata->>'chunkIndex')::int
    `, [document.documentId]);

    const chunks = allChunks.rows as any[];
    const currentIndex = chunks.findIndex(c => c.chunk_id === document.chunkId);

    if (currentIndex === -1) {
      return {
        before: [],
        match: document,
        after: [],
        combinedText: document.content,
      };
    }

    const before = chunks
      .slice(Math.max(0, currentIndex - windowSize), currentIndex)
      .map(this.rowToDocument);

    const after = chunks
      .slice(currentIndex + 1, currentIndex + 1 + windowSize)
      .map(this.rowToDocument);

    const combinedText = [
      ...before.map(d => d.content),
      document.content,
      ...after.map(d => d.content),
    ].join('\n\n');

    return { before, match: document, after, combinedText };
  }

  /**
   * Convert database row to StoredDocument
   */
  private rowToDocument(row: any): StoredDocument {
    return {
      id: row.id,
      chunkId: row.chunk_id,
      documentId: row.document_id,
      content: row.content,
      embedding: [],
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Search service not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
let defaultSearchService: SemanticSearchService | null = null;

export function getSearchService(): SemanticSearchService {
  if (!defaultSearchService) {
    defaultSearchService = new SemanticSearchService();
  }
  return defaultSearchService;
}
```

---

## Using the Search Service

### Basic Search

```typescript
// src/demo-search.ts

import { SemanticSearchService } from './lib/search';

async function main() {
  const searchService = new SemanticSearchService();
  await searchService.initialize();

  // Simple search
  const results = await searchService.search({
    text: 'How do I build interactive web applications?',
    limit: 5,
  });

  console.log(`\n🔍 Found ${results.totalMatches} results in ${results.duration}ms\n`);

  for (const result of results.results) {
    console.log(`${result.rank}. [${(result.score * 100).toFixed(1)}%] `);
    console.log(`   ${result.document.content.substring(0, 100)}...`);
    
    if (result.highlights && result.highlights.length > 0) {
      console.log(`   💡 Highlights:`);
      result.highlights.forEach(h => console.log(`      - "${h}"`));
    }
    console.log('');
  }
}

main();
```

### Search with Filters

```typescript
// Search only documents with specific metadata
const results = await searchService.search({
  text: 'machine learning models',
  limit: 5,
  filters: {
    category: 'education',
    level: 'intermediate',
  },
});
```

### Search with Context

```typescript
// Get surrounding chunks for better context
const results = await searchService.search({
  text: 'What is React?',
  limit: 3,
  includeContext: true,
  contextWindow: 2, // 2 chunks before and after
});

for (const result of results.results) {
  if (result.context) {
    console.log('Context:', result.context.combinedText);
  }
}
```

---

## Improving Search Quality

### 1. Query Expansion

Add synonyms and related terms to improve recall:

```typescript
// src/lib/search/query-expansion.ts

const SYNONYMS: Record<string, string[]> = {
  'build': ['create', 'develop', 'make', 'construct'],
  'web': ['website', 'internet', 'online'],
  'app': ['application', 'program', 'software'],
  'learn': ['study', 'understand', 'master'],
};

export function expandQuery(query: string): string {
  let expanded = query;
  
  for (const [word, synonyms] of Object.entries(SYNONYMS)) {
    if (query.toLowerCase().includes(word)) {
      // Create OR group with synonyms
      expanded += ` ${synonyms.join(' ')}`;
    }
  }
  
  return expanded;
}
```

### 2. Result Re-ranking

Apply additional scoring factors:

```typescript
// src/lib/search/ranker.ts

interface RankingFactors {
  similarityScore: number;
  recency: Date;
  documentLength: number;
  exactMatches: number;
}

export function calculateFinalScore(factors: RankingFactors): number {
  // Base similarity score (0-1)
  let score = factors.similarityScore;
  
  // Recency boost (up to 10%)
  const daysSinceCreation = 
    (Date.now() - factors.recency.getTime()) / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 0.1 - (daysSinceCreation * 0.001));
  score += recencyBoost;
  
  // Exact match boost (5% per match, up to 15%)
  const exactMatchBoost = Math.min(0.15, factors.exactMatches * 0.05);
  score += exactMatchBoost;
  
  // Normalize to 0-1
  return Math.min(1, score);
}
```

### 3. Diversity Sampling

Ensure results come from different documents:

```typescript
export function diversifyResults(
  results: SearchResultItem[],
  maxPerDocument: number = 2
): SearchResultItem[] {
  const documentCounts = new Map<string, number>();
  const diversified: SearchResultItem[] = [];

  for (const result of results) {
    const docId = result.document.documentId;
    const count = documentCounts.get(docId) || 0;
    
    if (count < maxPerDocument) {
      diversified.push(result);
      documentCounts.set(docId, count + 1);
    }
  }

  return diversified;
}
```

---

## 🎯 Exercise: Implement Typo Tolerance

Create a function that handles common typos in search queries:

```typescript
function normalizeQuery(query: string): string {
  // Handle common typos and variations
}
```

<details>
<summary>💡 Hint</summary>

Consider:
- Common character swaps (ie vs ei)
- Double letters
- Missing letters
- Phonetic similarity

You can use a simple Levenshtein distance check or a dictionary of common misspellings.

</details>

<details>
<summary>✅ Solution</summary>

```typescript
const COMMON_TYPOS: Record<string, string> = {
  'developement': 'development',
  'programing': 'programming',
  'recieve': 'receive',
  'seperate': 'separate',
  'occured': 'occurred',
  'definately': 'definitely',
  'javascript': 'javascript',
  'typscript': 'typescript',
  'pyhton': 'python',
  'mahcine': 'machine',
  'artifical': 'artificial',
  'algorythm': 'algorithm',
};

function normalizeQuery(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  
  const correctedWords = words.map(word => {
    // Check direct matches first
    if (COMMON_TYPOS[word]) {
      return COMMON_TYPOS[word];
    }
    
    // Fuzzy match for close typos
    for (const [typo, correct] of Object.entries(COMMON_TYPOS)) {
      if (levenshteinDistance(word, typo) <= 2) {
        return correct;
      }
    }
    
    return word;
  });
  
  return correctedWords.join(' ');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}
```

</details>

---

## ✅ Checkpoint

Before moving on, make sure you can:

- [ ] Build a semantic search service
- [ ] Generate query embeddings on-the-fly
- [ ] Filter results by similarity threshold
- [ ] Add metadata-based filtering
- [ ] Include context windows in results
- [ ] Apply re-ranking strategies

---

## What's Next?

Now that we have semantic search working, let's integrate it with LLM generation to build a complete RAG (Retrieval Augmented Generation) pipeline!

**[➡️ Continue to Step 7: RAG Pipeline](./07-rag-pipeline.md)**

**[⬅️ Back to Step 5: Vector Storage](./05-vector-storage.md)**
