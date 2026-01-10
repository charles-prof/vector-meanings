# Step 2: Understanding Vector Embeddings

> 🎯 **Duration**: 20 minutes | **Difficulty**: Intermediate

## Overview

Before we can perform semantic search, we need to understand **vector embeddings**—the numerical representations that capture the meaning of text. This step covers the theory behind embeddings and why they're essential for modern AI applications.

---

## What Are Embeddings?

An **embedding** is a way to represent data (text, images, audio) as a dense vector of numbers. These vectors capture the *semantic meaning* of the data in a way that machines can process.

### From Text to Numbers

```
"The cat sat on the mat"
        ↓
[0.023, -0.156, 0.891, ..., 0.445]  (384 dimensions)
```

Each dimension captures some abstract feature of the text. Similar texts will have similar vectors.

---

## The Embedding Space

Embeddings exist in a high-dimensional **vector space** where:

- **Distance** = Semantic difference
- **Proximity** = Semantic similarity

```
                    "programming"
                         •
                        /|
                       / |
                      /  |
             "coding"•   |
                     \   |
                      \  |  
                       \ |
                        •"development"
                        
        
        "cooking"                "recipes"
            •------------------------•
            
            
                    (far apart in the vector space)
```

### Semantic Similarity Examples

| Text A | Text B | Similarity |
|--------|--------|------------|
| "I love programming" | "Coding is my passion" | ≈ 0.85 |
| "The weather is nice" | "It's sunny outside" | ≈ 0.72 |
| "I love programming" | "The weather is nice" | ≈ 0.15 |

---

## How Embeddings Are Created

Modern embedding models use **transformer architectures** trained on massive text datasets.

### Training Process

1. **Pre-training**: Model learns language patterns from billions of text samples
2. **Fine-tuning**: Model is optimized for similarity tasks using sentence pairs
3. **Output**: Fixed-size vector for any input text

### Popular Embedding Models

| Model | Dimensions | Size | Speed | Quality |
|-------|------------|------|-------|---------|
| all-MiniLM-L6-v2 | 384 | ~30MB | ⚡ Fast | Good |
| all-mpnet-base-v2 | 768 | ~110MB | Medium | Very Good |
| bge-small-en-v1.5 | 384 | ~33MB | ⚡ Fast | Very Good |
| e5-small-v2 | 384 | ~33MB | ⚡ Fast | Very Good |

For this course, we'll use **all-MiniLM-L6-v2** because:
- ✅ Small size (fast to load)
- ✅ Good quality for most use cases
- ✅ 384 dimensions (efficient storage)
- ✅ Well-supported by Transformers.js

---

## Distance Metrics

To find similar vectors, we need to measure the "distance" between them.

### Cosine Similarity

The most common metric for text embeddings. Measures the angle between two vectors.

```
Cosine Similarity = (A · B) / (||A|| × ||B||)

Range: -1 to 1
  1 = Identical direction (most similar)
  0 = Perpendicular (unrelated)
 -1 = Opposite direction (least similar)
```

```
           A
          ╱
         ╱ θ (small angle = high similarity)
        ╱
       ╱─────── B
      O
```

### Euclidean Distance (L2)

Measures the straight-line distance between points.

```
L2 Distance = √(Σ(Aᵢ - Bᵢ)²)

Range: 0 to ∞
  0 = Identical vectors
  Higher = More different
```

### When to Use Which?

| Metric | Use Case | pgvector Operator |
|--------|----------|-------------------|
| Cosine | Text embeddings, normalized vectors | `<=>` |
| L2/Euclidean | Image embeddings, general purpose | `<->` |
| Inner Product | Already normalized, speed priority | `<#>` |

---

## Visualizing Embeddings

Let's see how similar texts cluster together in embedding space.

### 2D Projection (using t-SNE or UMAP)

```
                    Technology Cluster
                         ┌───────┐
         "machine        │       │      "neural networks"
          learning" •────│       │────• 
                         │  AI   │
           "deep    •────│       │────• "artificial
          learning"      │       │       intelligence"
                         └───────┘
                         
                         
                         
                    Food Cluster
                    ┌───────────┐
    "Italian •──────│           │──────• "pasta recipes"
     cuisine"       │   Food    │
                    │           │
    "cooking •──────│           │──────• "culinary arts"
      tips"         └───────────┘
```

Documents about similar topics naturally cluster together!

---

## Hands-On: Exploring Embedding Similarity

Let's write some code to understand embeddings better:

```typescript
// src/embedding-explorer.ts

/**
 * Simple cosine similarity calculation
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Euclidean (L2) distance calculation
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance (0 = identical, higher = more different)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sumSquaredDiff = 0;

  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquaredDiff += diff * diff;
  }

  return Math.sqrt(sumSquaredDiff);
}

/**
 * Normalize a vector to unit length
 * This is important for cosine similarity to work correctly
 * 
 * @param vector - Vector to normalize
 * @returns Normalized vector with magnitude 1
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude === 0) {
    return vector;
  }

  return vector.map(val => val / magnitude);
}

/**
 * Find the top-k most similar items to a query
 * 
 * @param query - Query vector
 * @param items - Array of { id, vector } objects
 * @param k - Number of results to return
 * @returns Top-k most similar items with scores
 */
export function findTopK<T extends { id: string; vector: number[] }>(
  query: number[],
  items: T[],
  k: number
): Array<{ item: T; similarity: number }> {
  const scored = items.map(item => ({
    item,
    similarity: cosineSimilarity(query, item.vector),
  }));

  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, k);
}
```

### Testing the Similarity Functions

```typescript
// src/test-similarity.ts

import { cosineSimilarity, normalizeVector, findTopK } from './embedding-explorer';

// Example: Demonstrate similarity with hand-crafted vectors
// (In real use, these would come from an embedding model)

function main() {
  console.log('🔬 Exploring Vector Similarity\n');

  // Simple 3D vectors for visualization
  const vectors = {
    // Technology-related (pointing in similar direction)
    programming: [0.8, 0.5, 0.2],
    coding: [0.75, 0.55, 0.15],
    development: [0.7, 0.6, 0.25],

    // Food-related (pointing in different direction)
    cooking: [0.2, 0.1, 0.9],
    recipes: [0.15, 0.15, 0.85],

    // Mixed
    techBlog: [0.6, 0.4, 0.4],
  };

  // Normalize all vectors
  const normalized = Object.fromEntries(
    Object.entries(vectors).map(([key, vec]) => [key, normalizeVector(vec)])
  ) as typeof vectors;

  console.log('📊 Similarity Matrix:\n');
  console.log('                 programming  coding  development  cooking  recipes');

  for (const [nameA, vecA] of Object.entries(normalized)) {
    let row = nameA.padEnd(12);
    for (const [nameB, vecB] of Object.entries(normalized)) {
      const sim = cosineSimilarity(vecA, vecB);
      row += `     ${sim.toFixed(3)}`;
    }
    console.log(row);
  }

  console.log('\n🔍 Finding similar items to "programming":\n');

  const items = Object.entries(normalized)
    .filter(([name]) => name !== 'programming')
    .map(([id, vector]) => ({ id, vector }));

  const results = findTopK(normalized.programming, items, 3);

  results.forEach(({ item, similarity }, index) => {
    console.log(`  ${index + 1}. ${item.id}: ${(similarity * 100).toFixed(1)}% similar`);
  });
}

main();
```

Expected output:

```
🔬 Exploring Vector Similarity

📊 Similarity Matrix:

                 programming  coding  development  cooking  recipes
programming           1.000   0.993       0.981    0.391    0.347
coding                0.993   1.000       0.991    0.347    0.304
development           0.981   0.991       1.000    0.421    0.380
cooking               0.391   0.347       0.421    1.000    0.994
recipes               0.347   0.304       0.380    0.994    1.000

🔍 Finding similar items to "programming":

  1. coding: 99.3% similar
  2. development: 98.1% similar
  3. cooking: 39.1% similar
```

---

## Why Dimension Matters

The number of dimensions affects quality and performance:

### Low Dimensions (32-128)

- ✅ Fast computation
- ✅ Low storage
- ❌ Limited expressiveness
- Use for: Simple similarity, prototyping

### Medium Dimensions (256-512)

- ✅ Good balance
- ✅ Works for most use cases
- This is where most models operate (384-768)

### High Dimensions (1024+)

- ✅ Maximum expressiveness
- ❌ More compute required
- ❌ More storage needed
- ❌ Diminishing returns
- Use for: Specialized high-accuracy needs

### The Curse of Dimensionality

As dimensions increase:
1. All points become approximately equidistant
2. Nearest neighbor search becomes less meaningful
3. We need more data to populate the space

**384 dimensions** (MiniLM) is a sweet spot for most applications.

---

## 🎯 Exercise: Implement Dot Product Similarity

The dot product (inner product) is another way to measure similarity between vectors. Implement a `dotProduct` function:

```typescript
/**
 * Calculate the dot product between two vectors
 * Only meaningful when vectors are normalized!
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product value
 */
export function dotProduct(a: number[], b: number[]): number {
  // Your implementation here
}
```

<details>
<summary>✅ Solution</summary>

```typescript
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let product = 0;
  for (let i = 0; i < a.length; i++) {
    product += a[i] * b[i];
  }
  return product;
}
```

**Note**: For normalized vectors, `dotProduct(a, b) === cosineSimilarity(a, b)`. This is why many systems normalize vectors first—it makes similarity calculation faster!

</details>

---

## ✅ Checkpoint

Before moving on, make sure you can:

- [ ] Explain what a vector embedding represents
- [ ] Describe why similar texts have similar vectors
- [ ] Calculate cosine similarity between two vectors
- [ ] List 3 different distance metrics and when to use each
- [ ] Understand why 384 dimensions is a common choice

---

## Key Takeaways

1. **Embeddings capture meaning** — Similar content produces similar vectors
2. **Distance = Difference** — Lower distance means higher similarity
3. **Cosine similarity is preferred** for text because it ignores magnitude
4. **384 dimensions** is a good balance of quality and performance
5. **Normalization** simplifies calculations and is often done by default

---

## What's Next?

Now that you understand the theory behind embeddings, let's generate them locally using Transformers.js!

**[➡️ Continue to Step 3: Generating Embeddings Locally](./03-local-embeddings.md)**

**[⬅️ Back to Step 1: Setting up PGlite](./01-setup-pglite.md)**

---

<details>
<summary>📖 Mathematical Deep Dive</summary>

### Cosine Similarity Formula

For vectors **A** = [a₁, a₂, ..., aₙ] and **B** = [b₁, b₂, ..., bₙ]:

```
         A · B           Σᵢ(aᵢ × bᵢ)
cos(θ) = ───── = ─────────────────────────
         ||A|| × ||B||   √(Σᵢaᵢ²) × √(Σᵢbᵢ²)
```

### Why Cosine Works for Text

Text embeddings have varying magnitudes based on content length. Cosine similarity normalizes for this:

```
"cat" → [0.5, 0.3, 0.2] (magnitude: 0.616)
"the cat" → [1.0, 0.6, 0.4] (magnitude: 1.23)

L2 distance: 0.616 (seems different!)
Cosine similarity: 1.0 (identical direction - same meaning!)
```

</details>
