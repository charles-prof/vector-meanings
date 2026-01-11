# Course Code Examples

This directory contains standalone TypeScript examples for each step of the **LLM Ingestion with PGlite** course.

## 🚀 How to Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run an Example**:
   Use the npm scripts to run the code for a specific step:

   ```bash
   # Step 1: PGlite Setup
   npm run step-01

   # Step 3: Local Embeddings
   npm run step-03

   # Step 4: Ingestion & Chunking
   npm run step-04

   # Step 7: Complete RAG Pipeline
   npm run step-07
   ```

## 📁 Examples Overview

| Folder | Topic | Key Concepts |
|--------|-------|--------------|
| `step-01-pglite` | PGlite Setup | Extension initialization, vector columns, basic similarity. |
| `step-03-embeddings` | Transformers.js | Pipeline usage, text-to-vector, cosine similarity. |
| `step-04-ingestion` | Chunking | Fixed-size and recursive text splitting strategies. |
| `step-07-rag` | RAG Pipeline | The complete flow from raw text to LLM-ready prompt. |

## 🛠️ Requirements

- **Node.js**: v18 or later is recommended.
- **Memory**: Running embedding models locally requires at least 2GB of free RAM.
- **Disk**: Models are cached locally on first run (approx 25MB for `all-MiniLM-L6-v2`).

---

*For the full web-based application, see the `final-project` directory.*
