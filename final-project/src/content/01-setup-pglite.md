# Step 1: Setting up PGlite with pgvector

> 🎯 **Duration**: 15 minutes | **Difficulty**: Beginner

## Overview

In this step, you'll learn how to set up **PGlite**—PostgreSQL running in WebAssembly—with the **pgvector** extension for vector similarity search. By the end, you'll have a fully functional vector database running in your browser or Node.js environment.

---

## What is PGlite?

**PGlite** is a lightweight PostgreSQL implementation that runs entirely in WebAssembly. This means:

- 🚀 **No server required**: PostgreSQL runs in your browser or Node.js
- 💾 **Persistent storage**: Data persists using IndexedDB (browser) or file system (Node.js)
- 🔌 **Extension support**: Use PostgreSQL extensions like pgvector
- 📦 **Small footprint**: Core library is ~3MB gzipped

### PGlite vs Traditional PostgreSQL

| Feature | Traditional PostgreSQL | PGlite |
|---------|----------------------|--------|
| Server Required | ✅ Yes | ❌ No |
| Installation | Complex | `npm install` |
| Multi-user | ✅ Yes | ❌ Single user |
| Extensions | ✅ All | ⚠️ Selected |
| Performance | High | Good for small-medium data |
| Use Case | Production servers | Local-first apps, prototyping |

---

## What is pgvector?

**pgvector** is a PostgreSQL extension that adds:

- **Vector data type**: Store arrays of floats as `vector(n)` where n is the dimension
- **Distance operators**: Calculate similarity between vectors
- **Index types**: Efficient approximate nearest neighbor (ANN) search

### Distance Functions

| Function | Operator | Use Case |
|----------|----------|----------|
| L2 distance | `<->` | Euclidean distance, general purpose |
| Inner product | `<#>` | When vectors are normalized |
| Cosine distance | `<=>` | Most common for text embeddings |

---

## Hands-On: Setting Up PGlite

Let's create a new project and set up PGlite with pgvector.

### Step 1.1: Create Project Structure

First, let's understand the project structure we'll be using for the code examples:

```
code-examples/
└── step-01/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts          # Main entry point
    │   └── lib/
    │       └── database.ts   # PGlite initialization
    └── README.md
```

### Step 1.2: Install Dependencies

```bash
# Navigate to the step-01 directory
cd code-examples/step-01

# Install PGlite and its vector extension
npm install @electric-sql/pglite
```

### Step 1.3: Initialize PGlite with pgvector

Create the database initialization module:

```typescript
// src/lib/database.ts

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

/**
 * Database configuration options
 */
interface DatabaseConfig {
  /** Name of the database (used for IndexedDB storage) */
  name: string;
  /** Vector dimension for embeddings */
  vectorDimension: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DatabaseConfig = {
  name: 'knowledge-base',
  vectorDimension: 384, // MiniLM model dimension
};

/**
 * Singleton PGlite instance
 */
let dbInstance: PGlite | null = null;

/**
 * Initialize PGlite with pgvector extension
 * 
 * @param config - Optional configuration overrides
 * @returns Promise<PGlite> - The initialized database instance
 */
export async function initializeDatabase(
  config: Partial<DatabaseConfig> = {}
): Promise<PGlite> {
  if (dbInstance) {
    return dbInstance;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('🚀 Initializing PGlite database...');

  // Create PGlite instance with vector extension
  // Using IndexedDB for persistent storage in the browser
  dbInstance = new PGlite(`idb://${finalConfig.name}`, {
    extensions: { vector },
  });

  // Wait for the database to be ready
  await dbInstance.waitReady;

  console.log('✅ PGlite database ready');

  // Enable the vector extension
  await dbInstance.exec('CREATE EXTENSION IF NOT EXISTS vector');
  console.log('✅ pgvector extension enabled');

  // Create the documents table with vector column
  await createDocumentsTable(dbInstance, finalConfig.vectorDimension);

  return dbInstance;
}

/**
 * Create the documents table for storing text chunks and their embeddings
 * 
 * @param db - PGlite instance
 * @param vectorDimension - Dimension of the embedding vectors
 */
async function createDocumentsTable(
  db: PGlite,
  vectorDimension: number
): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      embedding vector(${vectorDimension}),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Documents table created');
}

/**
 * Get the current database instance
 * 
 * @returns The PGlite instance or null if not initialized
 */
export function getDatabase(): PGlite | null {
  return dbInstance;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    console.log('🔌 Database connection closed');
  }
}
```

### Step 1.4: Test the Setup

Create a test file to verify everything works:

```typescript
// src/index.ts

import { initializeDatabase, closeDatabase } from './lib/database';

/**
 * Main function to test PGlite setup
 */
async function main(): Promise<void> {
  console.log('🎯 Testing PGlite with pgvector setup\n');

  try {
    // Initialize the database
    const db = await initializeDatabase();

    // Insert a test document with a dummy embedding
    const testContent = 'This is a test document about machine learning.';
    const testEmbedding = new Array(384).fill(0).map(() => Math.random());

    await db.query(
      `INSERT INTO documents (content, embedding, metadata) 
       VALUES ($1, $2, $3)`,
      [
        testContent,
        JSON.stringify(testEmbedding),
        JSON.stringify({ source: 'test', category: 'ml' })
      ]
    );

    console.log('✅ Test document inserted');

    // Query the document
    const result = await db.query('SELECT id, content, metadata FROM documents');
    console.log('\n📄 Documents in database:');
    console.log(result.rows);

    // Test vector similarity (using random vectors for now)
    const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
    
    const similarDocs = await db.query(
      `SELECT id, content, 
              1 - (embedding <=> $1) as similarity
       FROM documents
       ORDER BY embedding <=> $1
       LIMIT 5`,
      [JSON.stringify(queryEmbedding)]
    );

    console.log('\n🔍 Similar documents (by cosine similarity):');
    console.log(similarDocs.rows);

    // Clean up
    await closeDatabase();
    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
```

---

## Understanding the Code

Let's break down the key concepts:

### 1. Creating a PGlite Instance

```typescript
const db = new PGlite(`idb://${name}`, {
  extensions: { vector },
});
```

- `idb://` prefix: Uses IndexedDB for persistent storage in the browser
- Alternative: `memory://` for in-memory storage (faster but not persistent)
- Alternative: File path for Node.js (e.g., `./pgdata`)

### 2. Enabling pgvector

```typescript
await db.exec('CREATE EXTENSION IF NOT EXISTS vector');
```

This SQL command enables the pgvector extension, giving us access to vector types and operators.

### 3. Creating a Vector Column

```typescript
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384),  -- 384-dimensional vector
  metadata JSONB DEFAULT '{}'
)
```

- `vector(384)`: Specifies a vector with 384 dimensions (MiniLM model output)
- Common dimensions: 384 (MiniLM), 768 (BERT), 1536 (OpenAI Ada)

### 4. Vector Similarity Search

```typescript
SELECT content, 1 - (embedding <=> $1) as similarity
FROM documents
ORDER BY embedding <=> $1
LIMIT 5
```

- `<=>`: Cosine distance operator (0 = identical, 2 = opposite)
- `1 - distance`: Converts to similarity score (1 = identical, -1 = opposite)
- `ORDER BY`: Sorts by distance, closest first
- `LIMIT 5`: Returns top 5 most similar documents

---

## 🎯 Exercise: Extend the Database Schema

Now it's your turn! Modify the database schema to add:

1. A `title` column for document titles
2. A `source_url` column for tracking where documents came from
3. An `updated_at` column that automatically updates on changes

<details>
<summary>💡 Hint</summary>

You'll need to modify the `createDocumentsTable` function. Consider using:
- `VARCHAR(255)` for the title
- `TEXT` for the source URL
- `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` with a trigger for updated_at

</details>

<details>
<summary>✅ Solution</summary>

```typescript
async function createDocumentsTable(
  db: PGlite,
  vectorDimension: number
): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      content TEXT NOT NULL,
      embedding vector(${vectorDimension}),
      metadata JSONB DEFAULT '{}',
      source_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create a trigger to auto-update updated_at
  await db.exec(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  await db.exec(`
    DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
    CREATE TRIGGER update_documents_updated_at
      BEFORE UPDATE ON documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  console.log('✅ Documents table created with all columns');
}
```

</details>

---

## ✅ Checkpoint

Before moving on, make sure you can:

- [ ] Explain what PGlite is and when to use it
- [ ] Understand the purpose of pgvector extension
- [ ] Create a database table with a vector column
- [ ] Insert data with vector embeddings
- [ ] Perform a basic vector similarity search

---

## Common Issues & Troubleshooting

### SharedArrayBuffer Warning

If you see warnings about SharedArrayBuffer, you may need to configure your server with the correct headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Vector Dimension Mismatch

If you get an error like `expected 384 dimensions, got 768`, ensure your embedding model output matches your column definition.

### Performance with Large Datasets

For datasets larger than 10,000 rows, you'll want to create an index (covered in Step 5).

---

## What's Next?

Now that we have our database set up, we need to understand how to create meaningful vector embeddings from text. In the next step, we'll explore what embeddings are and how they capture semantic meaning.

**[➡️ Continue to Step 2: Understanding Vector Embeddings](./02-vector-embeddings.md)**

**[⬅️ Back to Introduction](./00-introduction.md)**

---

<details>
<summary>📖 API Reference</summary>

### PGlite Constructor

```typescript
new PGlite(dataDir: string, options?: PGliteOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `dataDir` | `string` | Storage location: `idb://name`, `memory://`, or file path |
| `options.extensions` | `object` | Extensions to load (e.g., `{ vector }`) |

### Key Methods

| Method | Description |
|--------|-------------|
| `db.query(sql, params?)` | Execute SQL and return results |
| `db.exec(sql)` | Execute SQL without results |
| `db.waitReady` | Promise that resolves when DB is ready |
| `db.close()` | Close the database connection |

</details>
