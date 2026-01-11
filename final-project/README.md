# Final Project: Local Knowledge Base

This is the final project for the **LLM Ingestion with PGlite** course. It demonstrates a complete, 100% on-device RAG (Retrieval Augmented Generation) frontend application.

## 🚀 Features

- 🧠 **On-Device Embeddings**: Uses `Xenova/all-MiniLM-L6-v2` via Transformers.js for browser-based vectorization.
- 🗄️ **Local Vector DB**: Uses PGlite with the `pgvector` extension for persistent storage in IndexedDB.
- 🔍 **Semantic Search**: Find documents by meaning using cosine similarity.
- 📄 **Chunking & Ingestion**: Integrated pipeline for processing text into searchable units.
- 📊 **Database Explorer**: Direct real-time inspection of your local Postgres tables.
- ✨ **Premium UI**: Built with React, Tailwind CSS, and shadcn/ui for a modern developer experience.

## 🛠️ Tech Stack

- **Framework**: Vite + React + TypeScript
- **Database**: [PGlite](https://pglite.dev/) + [pgvector](https://github.com/pgvector/pgvector)
- **ML Engine**: [Transformers.js](https://huggingface.co/docs/transformers.js)
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide React

## 🏁 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Open Application**:
   Navigate to `http://localhost:5173`.

## 📖 How to Use

1. **Wait for Model Load**: On the first run, the embedding model (~22MB) will download. The status bar will show progress.
2. **Ingest Content**: Paste text into the "New Document" area and click "Ingest". This chunks the text and stores vectors in your browser.
3. **Search**: Type a question in the search bar. The app will vectorize your query and find the most relevant chunks using vector similarity search.
4. **Offline Use**: Since everything is local, once the model is cached, the app works entirely offline!

## 🧪 Experiments to Try

- **Large Documents**: Try pasting a long article and see how chunking works.
- **Deep Similarity**: Search for concepts using synonyms rather than exact words.
- **Inspect DB**: Open your browser's Developer Tools → Application → IndexedDB to see the PGlite data.

---

*Part of the "LLM Ingestion with PGlite" Codelab.*
