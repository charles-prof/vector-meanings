# Step 0: Introduction to LLM Ingestion

> 🎯 **Duration**: 10 minutes | **Difficulty**: Beginner

## Overview

Welcome to this comprehensive codelab on **LLM Ingestion with PGlite**! In this course, you'll learn how to build privacy-focused Retrieval Augmented Generation (RAG) applications that run entirely on your device—no external API calls required for embeddings.

---

## What is LLM Ingestion?

**LLM Ingestion** is the process of preparing and storing data in a format that Large Language Models (LLMs) can efficiently retrieve and use. This involves:

1. **Document Processing**: Breaking down documents into manageable chunks
2. **Embedding Generation**: Converting text into numerical vectors that capture semantic meaning
3. **Vector Storage**: Storing these embeddings in a database optimized for similarity search
4. **Retrieval**: Finding the most relevant chunks when answering questions

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Documents  │ ──▶ │   Chunking   │ ──▶ │  Embedding  │ ──▶ │   Vector     │
│  (txt, pdf) │     │  Processing  │     │  Generation │     │   Storage    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                                                                     │
                                                                     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Answer    │ ◀── │     LLM      │ ◀── │   Context   │ ◀── │  Semantic    │
│  Response   │     │  Generation  │     │  Retrieved  │     │   Search     │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

---

## What is RAG (Retrieval Augmented Generation)?

**RAG** combines the power of retrieval systems with LLM generation to produce more accurate, grounded responses.

### How RAG Works

1. **User Query**: User asks a question
2. **Semantic Search**: Find relevant documents using vector similarity
3. **Context Injection**: Add retrieved documents to the LLM prompt
4. **Generation**: LLM generates a response grounded in the retrieved context

### Why RAG Matters

| Problem | RAG Solution |
|---------|--------------|
| LLMs hallucinate | Ground responses in actual documents |
| Training data is outdated | Use up-to-date, custom knowledge |
| Generic responses | Provide domain-specific answers |
| Privacy concerns | Keep sensitive data local |

---

## Why On-Device Vectorization?

Traditional RAG applications send your data to external APIs (like OpenAI or Cohere) to generate embeddings. This approach has significant drawbacks:

### 🔒 Privacy

Your documents never leave your device. This is crucial for:
- Sensitive business documents
- Personal notes and journals
- Healthcare or legal information
- Any data governed by compliance regulations (GDPR, HIPAA)

### 💰 Cost

No per-token API charges. Once you download the model (~30MB), you can generate unlimited embeddings for free.

### ⚡ Latency

No network round-trips mean faster processing:
- Local embedding: ~50-100ms per chunk
- API embedding: ~200-500ms including network latency

### 🌐 Offline Capability

Works without an internet connection. Perfect for:
- Desktop applications
- Progressive Web Apps (PWAs)
- Edge computing scenarios

---

## Technology Stack

This course uses the following technologies:

### PGlite

**PGlite** is PostgreSQL compiled to WebAssembly, running directly in your browser or Node.js environment.

- ✅ Full PostgreSQL compatibility
- ✅ No server setup required
- ✅ Persistent storage with IndexedDB
- ✅ Works in browsers and Node.js

### pgvector

**pgvector** is a PostgreSQL extension for vector similarity search.

- ✅ Store vectors with up to 2,000 dimensions
- ✅ Multiple distance functions (L2, cosine, inner product)
- ✅ Efficient indexing with IVFFlat and HNSW

### Transformers.js

**Transformers.js** brings Hugging Face's transformer models to JavaScript.

- ✅ Run inference directly in the browser
- ✅ Pre-trained embedding models
- ✅ Optimized for WebGPU and WASM

### shadcn/ui

**shadcn/ui** provides beautifully designed, accessible components for the final project's UI.

---

## What You'll Build

By the end of this course, you'll have built a complete **Local Knowledge Base** application:

### Features

- 📄 **Document Upload**: Drag-and-drop interface for adding documents
- 🧠 **On-Device Embeddings**: Generate vectors without any API calls
- 🗄️ **Vector Storage**: Persistent storage using PGlite + pgvector
- 🔍 **Semantic Search**: Find relevant content by meaning, not keywords
- 💬 **RAG Q&A**: Ask questions and get grounded answers

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │   shadcn/ui    │  │ Transformers.js│  │    PGlite      │  │
│  │   Components   │  │   Embeddings   │  │   + pgvector   │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  │
│           │                  │                   │            │
│           └──────────────────┼───────────────────┘            │
│                              │                                │
│                    ┌─────────────────┐                        │
│                    │   Application   │                        │
│                    │     Logic       │                        │
│                    └─────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before starting this course, make sure you have:

### Required

- **Node.js 18+**: [Download Node.js](https://nodejs.org/)
- **Modern Browser**: Chrome 89+, Firefox 89+, or Edge 89+ (for SharedArrayBuffer support)
- **Basic JavaScript/TypeScript**: Variables, functions, async/await, modules

### Recommended

- **VS Code**: For the best development experience
- **Git**: For version control and cloning the repository

### Check Your Setup

Run these commands to verify your environment:

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version

# Check git
git --version
```

---

## How This Course Works

Each step follows a consistent structure:

### 📚 Concept Explanation

We start with the theory—what you're learning and why it matters.

### 💻 Code Examples

Practical, runnable code that demonstrates the concept.

### 🎯 Hands-On Exercise

A challenge for you to complete, reinforcing what you learned.

### ✅ Checkpoint

Verify your understanding before moving on.

---

## Getting Started

Let's set up your development environment and start building!

### Clone the Repository

```bash
git clone https://github.com/yourusername/llm-ingestion-pglite-codelab.git
cd llm-ingestion-pglite-codelab
```

### Install Dependencies

```bash
npm install
```

### Start the Development Server

```bash
npm run dev
```

Open your browser to `http://localhost:5173` to see the application.

---

## Ready?

You're all set to begin your journey into on-device LLM ingestion!

**[➡️ Continue to Step 1: Setting up PGlite](./01-setup-pglite.md)**

---

<details>
<summary>📖 Quick Reference: Key Terms</summary>

| Term | Definition |
|------|------------|
| **Embedding** | A vector (array of numbers) representing the semantic meaning of text |
| **Vector** | A mathematical representation with magnitude and direction |
| **RAG** | Retrieval Augmented Generation - combining search with LLM generation |
| **Semantic Search** | Finding content by meaning rather than exact keyword matching |
| **PGlite** | PostgreSQL compiled to WebAssembly for browser/Node.js |
| **pgvector** | PostgreSQL extension for vector operations |
| **Transformers.js** | JavaScript library for running ML models in the browser |

</details>
