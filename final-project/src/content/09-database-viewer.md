# Step 9: Database Viewer (Bonus)

> 📊 **Peek behind the curtain of your local PostgreSQL instance**

One of the challenges with on-device AI is that the data is "invisible" to traditional server-side tools. To solve this, we've implemented a **Database Viewer** directly in the final project.

## 🧐 Why a DB Viewer?

When building RAG applications, you often ask:
1. "Did my text actually get chunked correctly?"
2. "What do the vectors actually look like?"
3. "Is my metadata being stored properly?"

The Database Viewer answers these by querying PGlite directly and displaying the raw table contents.

## 🛠️ How it Works

In PGlite, you can run standard SQL queries just like any other Postgres database. The viewer performs a simple fetch:

```typescript
const result = await db.query('SELECT * FROM documents ORDER BY id DESC LIMIT 50');
```

### Visualizing Vectors

Vectors are just arrays of numbers (floats). In our viewer, we take the `embedding` column and:
1. **Truncate** it for display (e.g., show the first 3 numbers).
2. **Visualize** it using a mini-sparkline or bars to show the relative magnitudes of the dimensions.

## 🚀 Managing Your Local Storage

The viewer also includes a **"Clear Database"** feature. This is essential for:
- Testing ingestion pipelines from scratch.
- Debugging chunking strategies.
- Handling storage limits in IndexedDB.

Simply call:
```sql
DELETE FROM documents;
```

## 🎓 Learning Objective

By using the Database Viewer, you'll see that **PGlite isn't just a cache—it's a real database**. You'll observe that even when you refresh the page, your data persists because PGlite syncs to your browser's **IndexedDB**.

---

⬅️ **[Step 08: Optimization](./08-optimization.md)** | 🏠 **[Home](../README.md)**
