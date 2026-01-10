# Step 4: Building a Document Ingestion Pipeline

> 🎯 **Duration**: 25 minutes | **Difficulty**: Intermediate

## Overview

Raw documents can't be directly processed by embedding models—they're often too long and contain irrelevant sections. In this step, you'll build a **document ingestion pipeline** that:

1. Loads documents from various sources
2. Extracts and cleans text content
3. Splits text into optimal chunks
4. Prepares chunks for embedding

---

## Why Chunking Matters

Embedding models have a **maximum token limit** (typically 256-512 tokens). Long documents must be split into chunks that:

- ✅ Fit within the model's context window
- ✅ Maintain semantic coherence
- ✅ Preserve important boundaries (paragraphs, sections)
- ✅ Include enough context for meaningful retrieval

### The Chunking Trade-off

| Chunk Size | Pros | Cons |
|------------|------|------|
| **Small** (100-200 tokens) | Precise retrieval | May lose context |
| **Medium** (200-400 tokens) | Good balance | Standard choice |
| **Large** (400-600 tokens) | More context | May dilute relevance |

---

## Chunking Strategies

### 1. Fixed-Size Chunking

The simplest approach: split by character/word count with overlap.

```
Document: [████████████████████████████████████████]
                    ↓
Chunks:   [████████]
              [████████]
                  [████████]
                      [████████]
                          ↓
          Overlap ensures no information is lost at boundaries
```

### 2. Sentence-Based Chunking

Respects sentence boundaries for more coherent chunks.

```
Sentence 1. Sentence 2. Sentence 3. | Sentence 4. Sentence 5. | ...
            ↓                                   ↓
         Chunk 1                             Chunk 2
```

### 3. Semantic Chunking

Uses heading structure and semantic breaks.

```
# Introduction        ← Chunk 1
Content...

## Background         ← Chunk 2
Content...

## Methods            ← Chunk 3
Content...
```

### 4. Recursive Chunking

Splits by largest separator first, then recursively splits oversized chunks.

```
Document
    ↓ Split by sections
[Section 1] [Section 2 - TOO BIG] [Section 3]
                    ↓ Split by paragraphs
            [Para 1] [Para 2] [Para 3]
```

---

## Hands-On: Building the Chunker

### Project Structure

```
src/
├── lib/
│   ├── chunking/
│   │   ├── index.ts           # Exports all chunking utilities
│   │   ├── types.ts           # Type definitions
│   │   ├── fixed-size.ts      # Fixed-size chunking
│   │   ├── sentence.ts        # Sentence-based chunking
│   │   └── recursive.ts       # Recursive chunking
│   └── ingestion/
│       ├── index.ts           # Main ingestion pipeline
│       ├── text-loader.ts     # Load text files
│       └── markdown-loader.ts # Load markdown files
└── index.ts
```

### Type Definitions

```typescript
// src/lib/chunking/types.ts

/**
 * A chunk of text with metadata
 */
export interface TextChunk {
  /** Unique identifier for this chunk */
  id: string;
  
  /** The text content of the chunk */
  content: string;
  
  /** Starting character index in original document */
  startIndex: number;
  
  /** Ending character index in original document */
  endIndex: number;
  
  /** Metadata inherited from document + chunk-specific */
  metadata: ChunkMetadata;
}

/**
 * Metadata associated with a chunk
 */
export interface ChunkMetadata {
  /** Source document identifier */
  documentId: string;
  
  /** Original document title */
  documentTitle?: string;
  
  /** Source file path or URL */
  source?: string;
  
  /** Chunk index within the document */
  chunkIndex: number;
  
  /** Total number of chunks in document */
  totalChunks: number;
  
  /** Section or heading this chunk belongs to */
  section?: string;
  
  /** Any additional custom metadata */
  [key: string]: unknown;
}

/**
 * Configuration for chunking
 */
export interface ChunkingConfig {
  /** Target chunk size in characters */
  chunkSize: number;
  
  /** Overlap between chunks in characters */
  chunkOverlap: number;
  
  /** Minimum chunk size (skip smaller chunks) */
  minChunkSize: number;
  
  /** Separators for splitting (in order of priority) */
  separators?: string[];
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 1000,      // ~200-250 tokens
  chunkOverlap: 200,    // ~50 tokens overlap
  minChunkSize: 100,    // Skip very small chunks
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '],
};
```

### Fixed-Size Chunker

```typescript
// src/lib/chunking/fixed-size.ts

import { TextChunk, ChunkingConfig, DEFAULT_CHUNKING_CONFIG, ChunkMetadata } from './types';
import { generateChunkId } from './utils';

/**
 * Split text into fixed-size chunks with overlap
 * 
 * @param text - The text to split
 * @param documentId - Unique identifier for the source document
 * @param config - Chunking configuration
 * @returns Array of text chunks
 */
export function fixedSizeChunk(
  text: string,
  documentId: string,
  config: Partial<ChunkingConfig> = {}
): TextChunk[] {
  const finalConfig = { ...DEFAULT_CHUNKING_CONFIG, ...config };
  const { chunkSize, chunkOverlap, minChunkSize } = finalConfig;

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    // Calculate end index for this chunk
    let endIndex = Math.min(startIndex + chunkSize, text.length);

    // Try to end at a sentence or word boundary
    if (endIndex < text.length) {
      const lastPeriod = text.lastIndexOf('. ', endIndex);
      const lastNewline = text.lastIndexOf('\n', endIndex);
      const lastSpace = text.lastIndexOf(' ', endIndex);

      // Find the best break point within a reasonable range
      const minEnd = startIndex + chunkSize * 0.8;
      
      if (lastPeriod > minEnd) {
        endIndex = lastPeriod + 1; // Include the period
      } else if (lastNewline > minEnd) {
        endIndex = lastNewline;
      } else if (lastSpace > minEnd) {
        endIndex = lastSpace;
      }
    }

    // Extract the chunk content
    const content = text.slice(startIndex, endIndex).trim();

    // Only add if meets minimum size
    if (content.length >= minChunkSize) {
      chunks.push({
        id: generateChunkId(documentId, chunkIndex),
        content,
        startIndex,
        endIndex,
        metadata: {
          documentId,
          chunkIndex,
          totalChunks: 0, // Will be updated after
        },
      });
      chunkIndex++;
    }

    // Move to next chunk with overlap
    startIndex = endIndex - chunkOverlap;
    
    // Prevent infinite loop
    if (startIndex >= endIndex) {
      startIndex = endIndex;
    }
  }

  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });

  return chunks;
}
```

### Sentence-Based Chunker

```typescript
// src/lib/chunking/sentence.ts

import { TextChunk, ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from './types';
import { generateChunkId } from './utils';

/**
 * Split text by sentences, grouping into chunks of target size
 * 
 * @param text - The text to split
 * @param documentId - Unique identifier for the source document
 * @param config - Chunking configuration
 * @returns Array of text chunks
 */
export function sentenceChunk(
  text: string,
  documentId: string,
  config: Partial<ChunkingConfig> = {}
): TextChunk[] {
  const finalConfig = { ...DEFAULT_CHUNKING_CONFIG, ...config };
  const { chunkSize, chunkOverlap, minChunkSize } = finalConfig;

  // Split into sentences (handling common abbreviations)
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];

  const chunks: TextChunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;
  let currentStartIndex = 0;
  let sentenceStartIndex = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if (!trimmedSentence) {
      sentenceStartIndex += sentence.length;
      continue;
    }

    // Check if adding this sentence would exceed chunk size
    if (currentLength + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      const content = currentChunk.join(' ').trim();
      
      if (content.length >= minChunkSize) {
        const endIndex = currentStartIndex + content.length;
        
        chunks.push({
          id: generateChunkId(documentId, chunkIndex),
          content,
          startIndex: currentStartIndex,
          endIndex,
          metadata: {
            documentId,
            chunkIndex,
            totalChunks: 0,
          },
        });
        chunkIndex++;
      }

      // Start new chunk with overlap
      const overlapSentences = getOverlapSentences(currentChunk, chunkOverlap);
      currentChunk = overlapSentences;
      currentLength = overlapSentences.join(' ').length;
      currentStartIndex = sentenceStartIndex - currentLength;
    }

    currentChunk.push(trimmedSentence);
    currentLength += trimmedSentence.length + 1; // +1 for space
    sentenceStartIndex += sentence.length;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    const content = currentChunk.join(' ').trim();
    
    if (content.length >= minChunkSize) {
      chunks.push({
        id: generateChunkId(documentId, chunkIndex),
        content,
        startIndex: currentStartIndex,
        endIndex: text.length,
        metadata: {
          documentId,
          chunkIndex,
          totalChunks: 0,
        },
      });
    }
  }

  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });

  return chunks;
}

/**
 * Get sentences that fit within the overlap budget
 */
function getOverlapSentences(sentences: string[], overlapSize: number): string[] {
  const result: string[] = [];
  let totalLength = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentence = sentences[i];
    if (totalLength + sentence.length > overlapSize) {
      break;
    }
    result.unshift(sentence);
    totalLength += sentence.length + 1;
  }

  return result;
}
```

### Recursive Chunker

```typescript
// src/lib/chunking/recursive.ts

import { TextChunk, ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from './types';
import { generateChunkId } from './utils';

/**
 * Recursively split text using a hierarchy of separators
 * 
 * @param text - The text to split
 * @param documentId - Unique identifier for the source document
 * @param config - Chunking configuration
 * @returns Array of text chunks
 */
export function recursiveChunk(
  text: string,
  documentId: string,
  config: Partial<ChunkingConfig> = {}
): TextChunk[] {
  const finalConfig = { ...DEFAULT_CHUNKING_CONFIG, ...config };

  const rawChunks = recursiveSplit(
    text,
    finalConfig.separators || DEFAULT_CHUNKING_CONFIG.separators!,
    finalConfig.chunkSize,
    finalConfig.chunkOverlap
  );

  // Filter and format chunks
  const chunks: TextChunk[] = rawChunks
    .filter(content => content.trim().length >= finalConfig.minChunkSize)
    .map((content, index) => ({
      id: generateChunkId(documentId, index),
      content: content.trim(),
      startIndex: text.indexOf(content), // Simplified - could be improved
      endIndex: text.indexOf(content) + content.length,
      metadata: {
        documentId,
        chunkIndex: index,
        totalChunks: 0,
      },
    }));

  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });

  return chunks;
}

/**
 * Recursive splitting implementation
 */
function recursiveSplit(
  text: string,
  separators: string[],
  chunkSize: number,
  chunkOverlap: number
): string[] {
  // Base case: text is small enough
  if (text.length <= chunkSize) {
    return [text];
  }

  // Try each separator in order
  for (const separator of separators) {
    if (text.includes(separator)) {
      const splits = text.split(separator);
      
      return mergeSplits(splits, separator, chunkSize, chunkOverlap, separators);
    }
  }

  // No separator found, force split at chunkSize
  const results: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
    results.push(text.slice(i, i + chunkSize));
  }
  return results;
}

/**
 * Merge splits back together respecting chunk size limits
 */
function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number,
  allSeparators: string[]
): string[] {
  const results: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const split of splits) {
    const splitLength = split.length + separator.length;

    if (currentLength + splitLength > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      const merged = currentChunk.join(separator);
      
      // If still too large, recursively split further
      if (merged.length > chunkSize) {
        const remainingSeparators = allSeparators.slice(allSeparators.indexOf(separator) + 1);
        results.push(...recursiveSplit(merged, remainingSeparators, chunkSize, chunkOverlap));
      } else {
        results.push(merged);
      }

      // Start new chunk
      currentChunk = [];
      currentLength = 0;
    }

    currentChunk.push(split);
    currentLength += splitLength;
  }

  // Handle remaining content
  if (currentChunk.length > 0) {
    const merged = currentChunk.join(separator);
    if (merged.length > chunkSize) {
      const remainingSeparators = allSeparators.slice(allSeparators.indexOf(separator) + 1);
      results.push(...recursiveSplit(merged, remainingSeparators, chunkSize, chunkOverlap));
    } else {
      results.push(merged);
    }
  }

  return results;
}
```

### Utility Functions

```typescript
// src/lib/chunking/utils.ts

import { createHash } from 'crypto';

/**
 * Generate a unique ID for a chunk
 * 
 * @param documentId - The parent document ID
 * @param chunkIndex - The index of this chunk
 * @returns A unique chunk ID
 */
export function generateChunkId(documentId: string, chunkIndex: number): string {
  const hash = createHash('md5')
    .update(`${documentId}-${chunkIndex}`)
    .digest('hex')
    .slice(0, 8);
  
  return `chunk-${hash}-${chunkIndex}`;
}

/**
 * Estimate token count from text
 * Rule of thumb: ~4 characters per token for English
 * 
 * @param text - The text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Clean text for embedding
 * Removes excessive whitespace and normalizes content
 * 
 * @param text - Raw text to clean
 * @returns Cleaned text
 */
export function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Trim
    .trim();
}
```

---

## The Ingestion Pipeline

### Main Pipeline

```typescript
// src/lib/ingestion/index.ts

import { TextChunk, ChunkingConfig } from '../chunking/types';
import { recursiveChunk } from '../chunking/recursive';
import { EmbeddingService, getEmbeddingService } from '../embeddings';
import { cleanText } from '../chunking/utils';

/**
 * Document to be ingested
 */
export interface Document {
  /** Unique identifier */
  id: string;
  
  /** Document title */
  title?: string;
  
  /** Raw text content */
  content: string;
  
  /** Optional source path/URL */
  source?: string;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Ingested chunk ready for storage
 */
export interface IngestedChunk {
  /** Chunk data */
  chunk: TextChunk;
  
  /** Generated embedding */
  embedding: number[];
}

/**
 * Ingestion result with statistics
 */
export interface IngestionResult {
  /** Document ID that was ingested */
  documentId: string;
  
  /** All ingested chunks with embeddings */
  chunks: IngestedChunk[];
  
  /** Total processing time in ms */
  duration: number;
  
  /** Statistics */
  stats: {
    originalLength: number;
    chunkCount: number;
    averageChunkSize: number;
    embeddingDimensions: number;
  };
}

/**
 * Ingestion pipeline configuration
 */
export interface IngestionConfig {
  /** Chunking configuration */
  chunking: Partial<ChunkingConfig>;
  
  /** Whether to clean text before chunking */
  cleanContent: boolean;
  
  /** Custom document preprocessing */
  preprocess?: (content: string) => string;
}

const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  chunking: {},
  cleanContent: true,
};

/**
 * Document ingestion pipeline
 * Handles the complete flow from raw document to embedded chunks
 * 
 * @example
 * ```typescript
 * const pipeline = new IngestionPipeline();
 * await pipeline.initialize();
 * 
 * const result = await pipeline.ingest({
 *   id: 'doc-1',
 *   title: 'My Document',
 *   content: 'Long document content...',
 * });
 * 
 * console.log(`Created ${result.chunks.length} chunks`);
 * ```
 */
export class IngestionPipeline {
  private config: IngestionConfig;
  private embeddingService: EmbeddingService;

  constructor(config: Partial<IngestionConfig> = {}) {
    this.config = { ...DEFAULT_INGESTION_CONFIG, ...config };
    this.embeddingService = getEmbeddingService();
  }

  /**
   * Initialize the pipeline (loads embedding model)
   */
  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    await this.embeddingService.initialize(onProgress);
  }

  /**
   * Check if pipeline is ready
   */
  get ready(): boolean {
    return this.embeddingService.ready;
  }

  /**
   * Ingest a single document
   * 
   * @param document - The document to ingest
   * @returns Ingestion result with chunks and embeddings
   */
  async ingest(document: Document): Promise<IngestionResult> {
    const startTime = performance.now();

    // Step 1: Preprocess content
    let content = document.content;
    
    if (this.config.preprocess) {
      content = this.config.preprocess(content);
    }
    
    if (this.config.cleanContent) {
      content = cleanText(content);
    }

    // Step 2: Chunk the document
    const textChunks = recursiveChunk(
      content,
      document.id,
      this.config.chunking
    );

    // Add document metadata to chunks
    textChunks.forEach(chunk => {
      chunk.metadata.documentTitle = document.title;
      chunk.metadata.source = document.source;
      if (document.metadata) {
        Object.assign(chunk.metadata, document.metadata);
      }
    });

    // Step 3: Generate embeddings for all chunks
    const ingestedChunks: IngestedChunk[] = [];

    for (const chunk of textChunks) {
      const embeddingResult = await this.embeddingService.embed(chunk.content);
      
      ingestedChunks.push({
        chunk,
        embedding: embeddingResult.embedding,
      });
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      documentId: document.id,
      chunks: ingestedChunks,
      duration,
      stats: {
        originalLength: document.content.length,
        chunkCount: ingestedChunks.length,
        averageChunkSize: Math.round(
          ingestedChunks.reduce((sum, c) => sum + c.chunk.content.length, 0) / 
          ingestedChunks.length
        ),
        embeddingDimensions: this.embeddingService.dimensions,
      },
    };
  }

  /**
   * Ingest multiple documents
   * 
   * @param documents - Array of documents to ingest
   * @param onProgress - Progress callback
   * @returns Array of ingestion results
   */
  async ingestBatch(
    documents: Document[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    for (let i = 0; i < documents.length; i++) {
      const result = await this.ingest(documents[i]);
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, documents.length);
      }
    }

    return results;
  }
}
```

---

## Using the Pipeline

```typescript
// src/demo-ingestion.ts

import { IngestionPipeline, Document } from './lib/ingestion';

async function main() {
  console.log('📥 Initializing ingestion pipeline...\n');

  const pipeline = new IngestionPipeline({
    chunking: {
      chunkSize: 500,
      chunkOverlap: 100,
    },
  });

  await pipeline.initialize((progress) => {
    process.stdout.write(`\r   Loading model: ${progress.toFixed(1)}%`);
  });
  console.log('\n');

  // Sample documents
  const documents: Document[] = [
    {
      id: 'doc-ml-intro',
      title: 'Introduction to Machine Learning',
      content: `
        Machine learning is a subset of artificial intelligence that enables 
        systems to learn and improve from experience without being explicitly 
        programmed. It focuses on developing algorithms that can access data 
        and use it to learn for themselves.
        
        There are three main types of machine learning:
        
        1. Supervised Learning: The algorithm learns from labeled training data
           and makes predictions based on that data. Examples include image 
           classification and spam detection.
        
        2. Unsupervised Learning: The algorithm finds patterns in unlabeled data.
           Common techniques include clustering and dimensionality reduction.
        
        3. Reinforcement Learning: The algorithm learns by interacting with an
           environment and receiving rewards or penalties for its actions.
        
        Machine learning has numerous applications including natural language
        processing, computer vision, recommendation systems, and autonomous
        vehicles. As computational power increases and more data becomes
        available, machine learning continues to advance rapidly.
      `,
      source: 'internal-docs',
      metadata: { category: 'education', level: 'beginner' },
    },
  ];

  // Ingest the documents
  console.log('📄 Ingesting documents...\n');

  for (const doc of documents) {
    const result = await pipeline.ingest(doc);

    console.log(`   Document: ${result.documentId}`);
    console.log(`   Chunks created: ${result.stats.chunkCount}`);
    console.log(`   Average chunk size: ${result.stats.averageChunkSize} chars`);
    console.log(`   Processing time: ${result.duration}ms`);
    console.log('');

    // Show first chunk as example
    const firstChunk = result.chunks[0];
    console.log('   First chunk preview:');
    console.log(`   "${firstChunk.chunk.content.substring(0, 100)}..."`);
    console.log(`   Embedding: [${firstChunk.embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log('');
  }

  console.log('✅ Ingestion complete!');
}

main();
```

---

## 🎯 Exercise: Add Markdown Support

Extend the pipeline to handle Markdown documents specially:

1. Extract headings as section metadata
2. Remove code blocks from embeddings (or embed separately)
3. Preserve bullet point structure

<details>
<summary>💡 Hint</summary>

Create a preprocessing function that:
- Uses regex to find headings (`# Title`, `## Section`)
- Removes or separates code blocks (``` ... ```)
- Keeps track of the current section for chunk metadata

</details>

<details>
<summary>✅ Solution</summary>

```typescript
// src/lib/ingestion/markdown-preprocessor.ts

interface MarkdownSection {
  heading: string;
  level: number;
  content: string;
  startIndex: number;
}

/**
 * Preprocess markdown content
 * Extracts sections and cleans formatting
 */
export function preprocessMarkdown(content: string): {
  cleanedContent: string;
  sections: MarkdownSection[];
  codeBlocks: string[];
} {
  const sections: MarkdownSection[] = [];
  const codeBlocks: string[] = [];

  // Extract code blocks
  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return '[CODE_BLOCK]';
  });

  // Find all headings
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  let lastIndex = 0;
  let lastHeading = 'Introduction';
  let lastLevel = 0;

  while ((match = headingRegex.exec(processed)) !== null) {
    // Save previous section
    if (lastIndex < match.index) {
      sections.push({
        heading: lastHeading,
        level: lastLevel,
        content: processed.slice(lastIndex, match.index).trim(),
        startIndex: lastIndex,
      });
    }

    lastHeading = match[2];
    lastLevel = match[1].length;
    lastIndex = match.index + match[0].length;
  }

  // Don't forget the last section
  if (lastIndex < processed.length) {
    sections.push({
      heading: lastHeading,
      level: lastLevel,
      content: processed.slice(lastIndex).trim(),
      startIndex: lastIndex,
    });
  }

  // Clean markdown formatting
  const cleanedContent = processed
    // Remove heading markers (but keep text)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove links but keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n');

  return { cleanedContent, sections, codeBlocks };
}
```

</details>

---

## ✅ Checkpoint

Before moving on, make sure you can:

- [ ] Explain why chunking is necessary for embeddings
- [ ] Compare different chunking strategies
- [ ] Implement fixed-size chunking with overlap
- [ ] Build a complete ingestion pipeline
- [ ] Process documents and generate embeddings

---

## What's Next?

Now that we can ingest documents and generate embeddings, let's store them in PGlite with pgvector for efficient retrieval!

**[➡️ Continue to Step 5: Vector Storage and Indexing](./05-vector-storage.md)**

**[⬅️ Back to Step 3: Generating Embeddings Locally](./03-local-embeddings.md)**
