export interface Lesson {
  id: string;
  title: string;
  description: string;
  filePath: string;
}

export const LESSONS: Lesson[] = [
  {
    id: '00',
    title: 'Introduction',
    description: 'Welcome to the world of On-Device AI.',
    filePath: '00-introduction.md'
  },
  {
    id: '01',
    title: 'Setting up PGlite',
    description: 'Initialize your local Postgres in the browser.',
    filePath: '01-setup-pglite.md'
  },
  {
    id: '02',
    title: 'Vector Embeddings',
    description: 'Understanding high-dimensional representations.',
    filePath: '02-vector-embeddings.md'
  },
  {
    id: '03',
    title: 'Local Embeddings',
    description: 'Running Transformers.js for privacy and speed.',
    filePath: '03-local-embeddings.md'
  },
  {
    id: '04',
    title: 'Document Ingestion',
    description: 'Chunking and processing text data.',
    filePath: '04-document-ingestion.md'
  },
  {
    id: '05',
    title: 'Vector Storage',
    description: 'Using pgvector for vector permanence.',
    filePath: '05-vector-storage.md'
  },
  {
    id: '06',
    title: 'Semantic Search',
    description: 'Implementing K-nearest neighbors search.',
    filePath: '06-semantic-search.md'
  },
  {
    id: '07',
    title: 'RAG Pipeline',
    description: 'Combining retrieval with LLM generation.',
    filePath: '07-rag-pipeline.md'
  },
  {
    id: '08',
    title: 'Optimization',
    description: 'Performance tuning and best practices.',
    filePath: '08-optimization.md'
  },
  {
    id: '09',
    title: 'Database Viewer',
    description: 'Inspect PGlite in real-time (Bonus).',
    filePath: '09-database-viewer.md'
  },
  {
    id: '10',
    title: 'Retrieval to Generation',
    description: 'Synthesizing answers with RAG (Bonus).',
    filePath: '10-from-retrieval-to-generation.md'
  },
  {
    id: '11',
    title: 'Chain-of-Thought',
    description: 'Improving answers with reasoning (Bonus).',
    filePath: '11-chain-of-thought-reasoning.md'
  },
  {
    id: '12',
    title: 'Hybrid RAG',
    description: 'Fusing local and world knowledge (Bonus).',
    filePath: '12-hybrid-rag-multi-source-answers.md'
  }
];
