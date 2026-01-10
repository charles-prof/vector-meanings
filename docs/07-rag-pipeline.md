# Step 7: Building the RAG Pipeline

> 🎯 **Duration**: 25 minutes | **Difficulty**: Advanced

## Overview

This is where everything comes together! In this step, you'll build a complete **Retrieval Augmented Generation (RAG)** pipeline that:

1. Takes a user question
2. Retrieves relevant context using semantic search
3. Constructs an effective prompt
4. Generates a grounded response

---

## RAG Architecture

```
User Question
      │
      ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Query     │ ──▶ │   Semantic   │ ──▶ │  Retrieved  │
│  Embedding  │     │    Search    │     │   Chunks    │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Answer    │ ◀── │     LLM      │ ◀── │   Prompt    │
│  Response   │     │  Generation  │     │   Builder   │
└─────────────┘     └──────────────┘     └─────────────┘
```

---

## The RAG Pipeline

### Project Structure

```
src/
├── lib/
│   ├── rag/
│   │   ├── index.ts           # Main RAG pipeline
│   │   ├── types.ts           # Type definitions
│   │   ├── prompt-builder.ts  # Prompt construction
│   │   └── response-parser.ts # Response processing
│   └── ...
└── index.ts
```

### Type Definitions

```typescript
// src/lib/rag/types.ts

import { SearchResultItem } from '../search/types';

/**
 * RAG query with options
 */
export interface RAGQuery {
  /** The user's question */
  question: string;
  
  /** Maximum number of context chunks */
  maxContextChunks?: number;
  
  /** Maximum context tokens */
  maxContextTokens?: number;
  
  /** Include source citations */
  includeSources?: boolean;
  
  /** Custom system prompt */
  systemPrompt?: string;
  
  /** Conversation history for multi-turn */
  history?: ConversationTurn[];
}

/**
 * A turn in the conversation
 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * RAG response
 */
export interface RAGResponse {
  /** The generated answer */
  answer: string;
  
  /** Source chunks used to generate the answer */
  sources: SourceReference[];
  
  /** Confidence score (if available) */
  confidence?: number;
  
  /** Processing metadata */
  metadata: {
    /** Time to retrieve context (ms) */
    retrievalTime: number;
    
    /** Time to generate response (ms) */
    generationTime: number;
    
    /** Total time (ms) */
    totalTime: number;
    
    /** Number of chunks used */
    chunksUsed: number;
    
    /** Estimated tokens in context */
    contextTokens: number;
  };
}

/**
 * Reference to a source document
 */
export interface SourceReference {
  /** Document title */
  title: string;
  
  /** Chunk content preview */
  preview: string;
  
  /** Relevance score */
  score: number;
  
  /** Document ID */
  documentId: string;
  
  /** Chunk ID */
  chunkId: string;
}

/**
 * Default RAG options
 */
export const DEFAULT_RAG_OPTIONS = {
  maxContextChunks: 5,
  maxContextTokens: 2000,
  includeSources: true,
};
```

### Prompt Builder

```typescript
// src/lib/rag/prompt-builder.ts

import { SearchResultItem } from '../search/types';
import { ConversationTurn } from './types';

/**
 * Default system prompt for RAG
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions based on the provided context.

Instructions:
1. Answer the question using ONLY the information from the provided context
2. If the context doesn't contain enough information to answer, say so clearly
3. Be concise and direct in your answers
4. If you quote from the context, indicate it with quotation marks
5. Do not make up information that isn't in the context`;

/**
 * Build the complete prompt for RAG
 */
export function buildRAGPrompt(
  question: string,
  contextChunks: SearchResultItem[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  history: ConversationTurn[] = []
): string {
  const contextSection = buildContextSection(contextChunks);
  const historySection = buildHistorySection(history);
  
  return `${systemPrompt}

---

## Context

The following information has been retrieved from the knowledge base:

${contextSection}

---

${historySection}
## Question

${question}

## Answer

Based on the context provided, `;
}

/**
 * Build the context section from search results
 */
function buildContextSection(chunks: SearchResultItem[]): string {
  if (chunks.length === 0) {
    return 'No relevant context found.';
  }

  return chunks
    .map((chunk, index) => {
      const title = chunk.document.metadata?.documentTitle || 'Unknown Source';
      const score = (chunk.score * 100).toFixed(0);
      
      return `### Source ${index + 1}: ${title} (${score}% relevant)

${chunk.document.content}`;
    })
    .join('\n\n');
}

/**
 * Build conversation history section
 */
function buildHistorySection(history: ConversationTurn[]): string {
  if (history.length === 0) {
    return '';
  }

  const formatted = history
    .map(turn => `**${turn.role === 'user' ? 'User' : 'Assistant'}**: ${turn.content}`)
    .join('\n\n');

  return `## Previous Conversation

${formatted}

---

`;
}

/**
 * Estimate token count for a prompt
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Truncate context to fit within token limit
 */
export function truncateContext(
  chunks: SearchResultItem[],
  maxTokens: number
): SearchResultItem[] {
  const result: SearchResultItem[] = [];
  let currentTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.document.content);
    
    if (currentTokens + chunkTokens > maxTokens) {
      break;
    }
    
    result.push(chunk);
    currentTokens += chunkTokens;
  }

  return result;
}
```

### The RAG Pipeline

```typescript
// src/lib/rag/index.ts

import { SemanticSearchService, getSearchService } from '../search';
import { 
  RAGQuery, 
  RAGResponse, 
  SourceReference,
  DEFAULT_RAG_OPTIONS 
} from './types';
import { 
  buildRAGPrompt, 
  truncateContext, 
  estimateTokens,
  DEFAULT_SYSTEM_PROMPT 
} from './prompt-builder';

/**
 * LLM provider interface
 * Implement this for different LLM backends
 */
export interface LLMProvider {
  /**
   * Generate a response from the LLM
   */
  generate(prompt: string): Promise<string>;
  
  /**
   * Get the model name
   */
  readonly modelName: string;
}

/**
 * Simple console-based "LLM" for testing
 * Replace with actual LLM integration
 */
export class MockLLMProvider implements LLMProvider {
  readonly modelName = 'mock-llm';

  async generate(prompt: string): Promise<string> {
    // In real implementation, this would call an actual LLM
    // For testing, we'll extract and summarize the context
    
    const contextMatch = prompt.match(/## Context\s+([\s\S]*?)---/);
    
    if (contextMatch && contextMatch[1]) {
      const context = contextMatch[1].trim();
      const firstSource = context.split('### Source 2')[0];
      const preview = firstSource.substring(0, 300);
      
      return `Based on the provided context, ${preview}...

This information comes from the knowledge base sources listed above.`;
    }
    
    return 'I could not find relevant information in the knowledge base to answer this question.';
  }
}

/**
 * WebLLM provider for on-device inference
 * Uses WebLLM for running models locally
 */
export class WebLLMProvider implements LLMProvider {
  readonly modelName: string;
  private engine: any = null;
  private isInitialized = false;

  constructor(modelId: string = 'Llama-3.2-1B-Instruct-q4f16_1-MLC') {
    this.modelName = modelId;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Dynamic import for WebLLM
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    
    console.log(`🤖 Loading LLM: ${this.modelName}...`);
    this.engine = await CreateMLCEngine(this.modelName);
    this.isInitialized = true;
    console.log('✅ LLM ready');
  }

  async generate(prompt: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const response = await this.engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  }
}

/**
 * RAG Pipeline
 * Combines retrieval and generation for question answering
 * 
 * @example
 * ```typescript
 * const rag = new RAGPipeline();
 * await rag.initialize();
 * 
 * const response = await rag.query({
 *   question: "What is machine learning?",
 * });
 * 
 * console.log(response.answer);
 * console.log('Sources:', response.sources);
 * ```
 */
export class RAGPipeline {
  private searchService: SemanticSearchService;
  private llmProvider: LLMProvider;
  private isInitialized = false;

  constructor(llmProvider?: LLMProvider) {
    this.searchService = getSearchService();
    this.llmProvider = llmProvider || new MockLLMProvider();
  }

  /**
   * Initialize the RAG pipeline
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing RAG pipeline...');
    await this.searchService.initialize();
    
    // Initialize LLM if it has an initialize method
    if ('initialize' in this.llmProvider) {
      await (this.llmProvider as any).initialize();
    }
    
    this.isInitialized = true;
    console.log('✅ RAG pipeline ready');
  }

  /**
   * Process a RAG query
   */
  async query(query: RAGQuery): Promise<RAGResponse> {
    this.ensureInitialized();

    const startTime = performance.now();
    const options = { ...DEFAULT_RAG_OPTIONS, ...query };

    // Step 1: Retrieve relevant context
    const retrievalStart = performance.now();
    
    const searchResults = await this.searchService.search({
      text: query.question,
      limit: options.maxContextChunks * 2, // Get extra for filtering
      threshold: 0.3,
    });

    // Truncate to fit token limit
    const contextChunks = truncateContext(
      searchResults.results,
      options.maxContextTokens
    );

    const retrievalTime = Math.round(performance.now() - retrievalStart);

    // Step 2: Build prompt
    const prompt = buildRAGPrompt(
      query.question,
      contextChunks,
      options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      options.history || []
    );

    // Step 3: Generate response
    const generationStart = performance.now();
    const answer = await this.llmProvider.generate(prompt);
    const generationTime = Math.round(performance.now() - generationStart);

    // Step 4: Extract sources
    const sources: SourceReference[] = options.includeSources
      ? contextChunks.map(chunk => ({
          title: String(chunk.document.metadata?.documentTitle || 'Unknown'),
          preview: chunk.document.content.substring(0, 150) + '...',
          score: chunk.score,
          documentId: chunk.document.documentId,
          chunkId: chunk.document.chunkId,
        }))
      : [];

    const totalTime = Math.round(performance.now() - startTime);

    return {
      answer,
      sources,
      metadata: {
        retrievalTime,
        generationTime,
        totalTime,
        chunksUsed: contextChunks.length,
        contextTokens: estimateTokens(prompt),
      },
    };
  }

  /**
   * Query with streaming response
   * (Implementation depends on LLM provider support)
   */
  async *queryStream(query: RAGQuery): AsyncGenerator<string> {
    // For providers that support streaming
    // This is a simplified version - actual implementation would stream from LLM
    
    const response = await this.query(query);
    
    // Simulate streaming by yielding word by word
    const words = response.answer.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Ensure pipeline is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('RAG pipeline not initialized. Call initialize() first.');
    }
  }

  /**
   * Get the LLM model name
   */
  get modelName(): string {
    return this.llmProvider.modelName;
  }
}

// Singleton instance
let defaultPipeline: RAGPipeline | null = null;

export function getRAGPipeline(llmProvider?: LLMProvider): RAGPipeline {
  if (!defaultPipeline) {
    defaultPipeline = new RAGPipeline(llmProvider);
  }
  return defaultPipeline;
}
```

---

## Using the RAG Pipeline

### Basic Usage

```typescript
// src/demo-rag.ts

import { RAGPipeline, MockLLMProvider } from './lib/rag';
import { IngestionPipeline } from './lib/ingestion';
import { VectorStore } from './lib/vector-store';

async function main() {
  // Initialize components
  const ingestionPipeline = new IngestionPipeline();
  const vectorStore = new VectorStore();
  const ragPipeline = new RAGPipeline(new MockLLMProvider());

  await ingestionPipeline.initialize();
  await vectorStore.initialize();
  await ragPipeline.initialize();

  // Ingest some sample documents first
  const documents = [
    {
      id: 'react-basics',
      title: 'React Fundamentals',
      content: `
        React is a JavaScript library for building user interfaces.
        It uses a component-based architecture where UI is broken into
        reusable pieces called components. Each component can have its
        own state and props. React uses JSX, a syntax extension that
        allows writing HTML-like code in JavaScript. The virtual DOM
        helps React efficiently update only the parts of the UI that
        have changed, making it very performant.
      `,
    },
    {
      id: 'react-hooks',
      title: 'React Hooks Guide',
      content: `
        Hooks are functions that let you use state and other React
        features in functional components. The most common hooks are
        useState for managing local state, useEffect for side effects,
        and useContext for accessing context. Custom hooks let you
        extract and reuse stateful logic between components. Hooks
        must be called at the top level of your component and cannot
        be called conditionally.
      `,
    },
  ];

  console.log('📥 Ingesting documents...\n');
  
  for (const doc of documents) {
    const result = await ingestionPipeline.ingest(doc);
    await vectorStore.addChunks(result.chunks);
    console.log(`   ✅ ${doc.id}: ${result.chunks.length} chunks`);
  }

  console.log('\n🤖 Ready for questions!\n');

  // Ask questions
  const questions = [
    'What is React and how does it work?',
    'How do I manage state in React?',
    'What are the rules for using hooks?',
  ];

  for (const question of questions) {
    console.log(`❓ Question: ${question}\n`);
    
    const response = await ragPipeline.query({
      question,
      includeSources: true,
    });

    console.log(`💬 Answer: ${response.answer}\n`);
    
    if (response.sources.length > 0) {
      console.log('📚 Sources:');
      response.sources.forEach((source, i) => {
        console.log(`   ${i + 1}. ${source.title} (${(source.score * 100).toFixed(0)}%)`);
      });
    }
    
    console.log(`\n⏱️  Retrieval: ${response.metadata.retrievalTime}ms | Generation: ${response.metadata.generationTime}ms\n`);
    console.log('---\n');
  }
}

main();
```

### Multi-turn Conversation

```typescript
// Maintain conversation history
const history: ConversationTurn[] = [];

// First question
const response1 = await ragPipeline.query({
  question: 'What is React?',
  history: [],
});

history.push({ role: 'user', content: 'What is React?' });
history.push({ role: 'assistant', content: response1.answer });

// Follow-up question
const response2 = await ragPipeline.query({
  question: 'How do hooks relate to that?',
  history: history,
});
```

### Streaming Response

```typescript
console.log('Answer: ');

for await (const chunk of ragPipeline.queryStream({
  question: 'Explain React components',
})) {
  process.stdout.write(chunk);
}

console.log('\n');
```

---

## Advanced Prompt Engineering

### Custom System Prompts

```typescript
const technicalAssistant = ragPipeline.query({
  question: 'How do I optimize React performance?',
  systemPrompt: `You are a senior React developer helping junior developers.

Instructions:
- Provide practical, production-ready advice
- Include code examples when helpful
- Mention common pitfalls to avoid
- Reference official React documentation patterns
- Be encouraging and educational`,
});
```

### Structured Output

```typescript
const structuredPrompt = `You are an API that returns JSON only.

Instructions:
- Return a valid JSON object
- Include "answer", "confidence", and "sources" fields
- confidence should be 0-100
- Do not include any text outside the JSON

Context: ${context}

Question: ${question}

JSON Response:`;
```

---

## 🎯 Exercise: Add Answer Verification

Create a function that verifies if the answer is actually grounded in the context:

```typescript
async function verifyAnswer(
  answer: string,
  contextChunks: SearchResultItem[]
): Promise<{
  isGrounded: boolean;
  confidence: number;
  unsupportedClaims: string[];
}> {
  // Your implementation
}
```

<details>
<summary>✅ Solution</summary>

```typescript
async function verifyAnswer(
  answer: string,
  contextChunks: SearchResultItem[],
  embeddingService: EmbeddingService
): Promise<{
  isGrounded: boolean;
  confidence: number;
  unsupportedClaims: string[];
}> {
  // Extract claims from the answer (simplified: use sentences)
  const claims = answer
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const unsupportedClaims: string[] = [];
  let supportedCount = 0;

  // Combine all context into one string
  const fullContext = contextChunks
    .map(c => c.document.content.toLowerCase())
    .join(' ');

  // Check each claim against context
  for (const claim of claims) {
    // Generate embedding for the claim
    const claimEmbedding = await embeddingService.embed(claim);
    
    // Check similarity against each context chunk
    let maxSimilarity = 0;
    
    for (const chunk of contextChunks) {
      const chunkEmbedding = await embeddingService.embed(chunk.document.content);
      const similarity = cosineSimilarity(
        claimEmbedding.embedding,
        chunkEmbedding.embedding
      );
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // Also check for keyword overlap
    const claimWords = new Set(claim.toLowerCase().split(/\s+/));
    const contextWords = new Set(fullContext.split(/\s+/));
    const overlap = [...claimWords].filter(w => contextWords.has(w)).length;
    const keywordScore = overlap / claimWords.size;

    // Combined score
    const groundedScore = (maxSimilarity + keywordScore) / 2;

    if (groundedScore > 0.5) {
      supportedCount++;
    } else {
      unsupportedClaims.push(claim);
    }
  }

  const confidence = claims.length > 0 
    ? (supportedCount / claims.length) * 100 
    : 0;

  return {
    isGrounded: confidence >= 70,
    confidence: Math.round(confidence),
    unsupportedClaims,
  };
}
```

</details>

---

## ✅ Checkpoint

Before moving on, make sure you can:

- [ ] Build a complete RAG pipeline
- [ ] Construct effective prompts with context
- [ ] Handle multi-turn conversations
- [ ] Extract and display source references
- [ ] Implement different LLM providers
- [ ] Apply prompt engineering techniques

---

## What's Next?

The final step covers performance optimization techniques to make your RAG pipeline production-ready!

**[➡️ Continue to Step 8: Performance Optimization](./08-optimization.md)**

**[⬅️ Back to Step 6: Semantic Search](./06-semantic-search.md)**
