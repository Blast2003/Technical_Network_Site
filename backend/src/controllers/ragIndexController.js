// src/controllers/ragIndexController.js
import {
  buildVectorStoreFromDocs,
  docsFromDatabase,
  rebuildVectorStoreFromDisk,
  similaritySearch,
  clearVectorStore,
  getSourceDocsCount
} from "../lib/vectorStore.js";

export async function indexHandler(req, res) {
  const { models , reindex } = req.body || {};

  try {
    if (reindex) {
      clearVectorStore();
    }

    if (!reindex) {
      const rebuilt = await rebuildVectorStoreFromDisk();
      if (rebuilt) {
        return res.json({
          ok: true,
          message: "Vector store rebuilt from disk",
          count: getSourceDocsCount()
        });
      }
    }

    const docs = await docsFromDatabase(models);
    if (!docs.length) {
      return res.status(400).json({ ok: false, message: "No docs found" });
    }

    await buildVectorStoreFromDocs(docs); // persists docs->rag_source_docs.json

    res.json({
      ok: true,
      message: "Indexing completed",
      count: docs.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function searchHandler(req, res) {
  const { query , k } = req.body || {};
  if (!query) return res.status(400).json({ ok: false, error: "Query required" });

  try {
    const matches = await similaritySearch(query, k);
    res.json({ ok: true, matches });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
