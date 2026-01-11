# LLM Ingestion with PGlite - A Complete Codelab

> 🎯 **Learn to build privacy-focused RAG applications with on-device vectorization**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PGlite](https://img.shields.io/badge/PGlite-Latest-green.svg)](https://pglite.dev/)

## 📚 Course Overview

This hands-on codelab teaches you how to build **Retrieval Augmented Generation (RAG)** applications that run **entirely on-device**. You'll learn to ingest documents, generate vector embeddings locally, store them in PGlite (PostgreSQL in WebAssembly), and perform semantic search—all without sending data to external servers.

### What You'll Learn

- ✅ Set up PGlite with the pgvector extension
- ✅ Understand vector embeddings and semantic similarity
- ✅ Generate embeddings locally using Transformers.js
- ✅ Build a document ingestion pipeline
- ✅ Store and index vectors for efficient search
- ✅ Implement semantic search with K-nearest neighbors
- ✅ Create a complete RAG pipeline
- ✅ Optimize performance for production use

### Prerequisites

- Basic JavaScript/TypeScript knowledge
- Familiarity with npm and Node.js (v18+)
- Understanding of async/await patterns
- A modern web browser (Chrome, Firefox, or Edge)

### Time to Complete

⏱️ **Approximately 2-3 hours**

---

## 📖 Course Structure

| Step | Topic | Description |
|------|-------|-------------|
| 00 | [Introduction](./docs/00-introduction.md) | Overview, objectives, and why on-device matters |
| 01 | [Setup PGlite](./docs/01-setup-pglite.md) | Install and configure PGlite with pgvector |
| 02 | [Vector Embeddings](./docs/02-vector-embeddings.md) | Understanding embeddings and semantic similarity |
| 03 | [Local Embeddings](./docs/03-local-embeddings.md) | Generate embeddings with Transformers.js |
| 04 | [Document Ingestion](./docs/04-document-ingestion.md) | Build a text chunking and ingestion pipeline |
| 05 | [Vector Storage](./docs/05-vector-storage.md) | Store embeddings and create indexes |
| 06 | [Semantic Search](./docs/06-semantic-search.md) | Implement K-nearest neighbors search |
| 07 | [RAG Pipeline](./docs/07-rag-pipeline.md) | Combine retrieval with LLM generation |
| 08 | [Optimization](./docs/08-optimization.md) | Performance tuning and best practices |
| 09 | [Database Viewer](./docs/09-database-viewer.md) | **Bonus**: Inspecting PGlite in real-time |
| 10 | [From Retrieval to Generation](./docs/10-from-retrieval-to-generation.md) | **Bonus**: Synthesizing answers with RAG |
| 11 | [Chain-of-Thought Reasoning](./docs/11-chain-of-thought-reasoning.md) | **Bonus**: Improving answers with CoT |
| 12 | [Hybrid RAG: Multi-Source Answers](./docs/12-hybrid-rag-multi-source-answers.md) | **Bonus**: Fusing local and world knowledge |

---

## 🚀 Final Project: Local Knowledge Base

The course culminates in building a complete **Local Knowledge Base** application featuring:

- 📄 Document upload and processing (TXT, MD, PDF)
- 🧠 On-device embedding generation
- 🗄️ Vector storage with PGlite + pgvector
- 🔍 Real-time semantic search
- 💬 RAG-powered Q&A interface
- 📊 **Real-time Database Explorer** (Inspect PGlite contents directly)
- 🎨 Modern UI with shadcn/ui components

![Final Project Preview](./docs/assets/final-project-preview.png)

➡️ **[Start the Final Project](./final-project/README.md)**

---

## 🛠️ Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/llm-ingestion-pglite-codelab.git

# Navigate to the project
cd llm-ingestion-pglite-codelab

# Install dependencies
npm install

# Start the development server
npm run dev
```

---

## 📁 Repository Structure

```
llm-ingestion-pglite-codelab/
├── docs/                    # Course content (markdown)
│   ├── 00-introduction.md
│   ├── 01-setup-pglite.md
│   ├── ...
│   └── assets/             # Images and diagrams
├── code-examples/          # Standalone examples for each step
│   ├── step-01/
│   ├── step-02/
│   └── ...
├── final-project/          # Complete working application
│   ├── src/
│   ├── package.json
│   └── README.md
├── package.json
└── README.md
```

---

## 🔗 Additional Resources

- [PGlite Documentation](https://pglite.dev/)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

<p align="center">
  Made with ❤️ for the developer community
</p>
