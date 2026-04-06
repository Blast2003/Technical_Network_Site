// src/lib/vectorStore.js
import fs from "fs";
import path from "path";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/ollama";
import { db } from "../lib/langchain.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DOCS_FILE = path.join(DATA_DIR, "rag_source_docs.json");

let vectorStore = null;
let sourceDocs = [];

// A promise used to serialize/await an in-progress rebuild
let rebuildPromise = null;

/* ------------------ Persistence ------------------ */

function saveSourceDocsToDisk(docs) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2), "utf8");
}

function loadSourceDocsFromDisk() {
  if (!fs.existsSync(DOCS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DOCS_FILE, "utf8"));
  } catch (err) {
    console.error("Failed to parse persisted source docs:", err);
    return null;
  }
}

/* ------------------ Embeddings ------------------ */

function createEmbeddings() {
  
  return new OllamaEmbeddings({
    model: "llama3.2",
    baseUrl: "http://localhost:11434"
  });
}

/* ------------------ Date parsing helpers ------------------ */

function extractDateRangeFromQuery(input) {
  if (!input || typeof input !== "string") return null;
  const lower = input.toLowerCase();

  const now = new Date();

  const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay = d => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  const startOfMonth = (y, m) => new Date(y, m, 1, 0, 0, 0, 0);
  const endOfMonth = (y, m) => new Date(y, m + 1, 0, 23, 59, 59, 999);
  const startOfYear = y => new Date(y, 0, 1, 0, 0, 0, 0);
  const endOfYear = y => new Date(y, 11, 31, 23, 59, 59, 999);
  const startOfWeekMonday = d => {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7;
    const s = new Date(date);
    s.setDate(date.getDate() - day);
    s.setHours(0,0,0,0);
    return s;
  };

  if (/\btoday\b/.test(lower)) return { from: startOfDay(now), to: endOfDay(now) };
  if (/\byesterday\b/.test(lower)) {
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }

  const agoRange = lower.match(/\b(?:last|past|in the last)\s+(\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/);
  if (agoRange) {
    let [, num, unit] = agoRange;
    num = Number(num);
    unit = unit.replace(/s$/,'');
    const to = new Date(), from = new Date();
    switch(unit) {
      case 'day': from.setDate(to.getDate() - num); break;
      case 'week': from.setDate(to.getDate() - (num * 7)); break;
      case 'month': from.setMonth(to.getMonth() - num); break;
      case 'year': from.setFullYear(to.getFullYear() - num); break;
      case 'hour': from.setHours(to.getHours() - num); break;
      case 'minute': from.setMinutes(to.getMinutes() - num); break;
      case 'second': from.setSeconds(to.getSeconds() - num); break;
      default: return null;
    }
    return { from, to };
  }

  const thisPeriod = lower.match(/\bthis (week|month|year)\b/);
  if (thisPeriod) {
    const p = thisPeriod[1];
    if (p === 'week') return { from: startOfWeekMonday(now), to: endOfDay(now) };
    if (p === 'month') return { from: startOfMonth(now.getFullYear(), now.getMonth()), to: endOfDay(now) };
    if (p === 'year') return { from: startOfYear(now.getFullYear()), to: endOfDay(now) };
  }

  const since = lower.match(/\bsince\s+(\d{4}-\d{2}-\d{2})\b/);
  if (since) {
    const d = new Date(since[1] + "T00:00:00");
    return { from: startOfDay(d), to: endOfDay(now) };
  }

  const between = lower.match(/\bbetween\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})\b/);
  if (between) {
    const a = new Date(between[1] + "T00:00:00");
    const b = new Date(between[2] + "T23:59:59");
    return { from: startOfDay(a), to: endOfDay(b) };
  }

  const agoExact = lower.match(/\b(\d+)\s+(years?|months?|weeks?|days?)\s+ago\b/);
  if (agoExact) {
    const n = Number(agoExact[1]);
    const unit = agoExact[2].replace(/s$/,'');
    if (unit === 'year') {
      const year = now.getFullYear() - n;
      return { from: startOfYear(year), to: endOfYear(year) };
    }
    if (unit === 'month') {
      const date = new Date(now); date.setMonth(now.getMonth() - n);
      const y = date.getFullYear(), m = date.getMonth();
      return { from: startOfMonth(y, m), to: endOfMonth(y, m) };
    }
    if (unit === 'week') {
      const date = new Date(now); date.setDate(now.getDate() - (n * 7));
      return { from: startOfWeekMonday(date), to: endOfDay(new Date(date.setDate(date.getDate() + 6))) };
    }
    if (unit === 'day') {
      const date = new Date(now); date.setDate(now.getDate() - n);
      return { from: startOfDay(date), to: endOfDay(date) };
    }
  }

  return null;
}

/* ------------------ Helper: map candidate -> rich doc ------------------ */

function pickRichDocForCandidate(candidate) {
  // candidate has .metadata (with pk) and .pageContent
  const meta = candidate.metadata || {};
  const pk = meta.pk ?? meta.id ?? null;

  // Try to find by matching sourceDocs entries:
  if (pk != null && sourceDocs?.length) {
    // allow numeric/string flexibility
    const found = sourceDocs.find(d => {
      // d.id might be numeric or string; compare both as strings
      return String(d.id) === String(pk) || String(d.id) === `posts_${String(pk)}`;
    });
    if (found) {
      // Return a shallow copy to avoid accidental mutation
      return {
        id: found.id,
        title: found.title ?? null,
        text: found.text ?? null,
        type: found.type ?? null,
        mainField: found.mainField ?? null,
        createdAt: found.createdAt ?? null,
        LikesNumber: found.LikesNumber ?? null,
        RepliesNumber: found.RepliesNumber ?? null,
        metadata: found.metadata ?? {}
      };
    }
  }

  // Fallback: try to reconstruct useful fields from metadata + pageContent
  const reconstructed = {
    id: pk ?? null,
    title: meta.title ?? null,
    text: (candidate.pageContent ?? "").split("\n\n").slice(-1)[0] || candidate.pageContent || null,
    type: meta.type ?? null,
    mainField: meta.mainField ?? null,
    createdAt: meta.createdAt ?? null,
    LikesNumber: meta.LikesNumber ?? null,
    RepliesNumber: meta.RepliesNumber ?? null,
    metadata: meta
  };

  return reconstructed;
}

/* ------------------ Vector Store ------------------ */

export async function buildVectorStoreFromDocs(docs, { persist = true } = {}) {
  if (!docs?.length) throw new Error("No documents to index");

  const embeddings = createEmbeddings();

  vectorStore = new MemoryVectorStore(embeddings);

  const BATCH_SIZE = 100;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);

    await vectorStore.addDocuments(
      batch.map(d => {
        const pageContent = d.pageContent || d.text || (
          `Post: ${d.title || ""}\nType: ${d.type || ""}\nMainField: ${d.mainField || ""}\nCreatedAt: ${d.createdAt || ""}\nLikes: ${d.LikesNumber ?? ""}\nReplies: ${d.RepliesNumber ?? ""}\n\n${d.text || ""}`
        );

        const metadata = d.metadata || {
          model: "posts",
          pk: d.id,
          title: d.title || null,
          createdAt: d.createdAt || null,
          type: d.type || null,
          mainField: d.mainField || null,
          LikesNumber: d.LikesNumber ?? null,
          RepliesNumber: d.RepliesNumber ?? null
        };

        return {
          pageContent,
          metadata
        };
      })
    );

    console.log(`Indexed ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }

  // store rich documents for lookup
  sourceDocs = docs;

  if (persist) {
    try {
      saveSourceDocsToDisk(docs);
    } catch (err) {
      console.warn("Failed to save source docs to disk:", err);
    }
  }
}

export async function rebuildVectorStoreFromDisk() {
  const persisted = loadSourceDocsFromDisk();
  if (!persisted?.length) {
    return false;
  }

  try {
    await buildVectorStoreFromDocs(persisted, { persist: false });
    console.log("Vector store rebuilt from disk (in-memory).");
    return true;
  } catch (err) {
    console.error("Failed to rebuild vector store from disk:", err);
    return false;
  }
}

export function clearVectorStore() {
  vectorStore = null;
  sourceDocs = [];
  if (fs.existsSync(DOCS_FILE)) fs.unlinkSync(DOCS_FILE);
}

export function getSourceDocsCount() {
  return sourceDocs.length;
}

/**
 * similaritySearch:
 *  - returns rich doc objects (id, title, text, type, mainField, createdAt, LikesNumber, RepliesNumber)
 *  - supports date-aware filtering (extracts date range from query)
 */

export async function similaritySearchAll(query, candidateFetch = 1000) {
  if (!query) throw new Error("Query required");
  candidateFetch = (typeof candidateFetch === "number" && candidateFetch > 0) ? candidateFetch : 1000;

  // ensure vector store exists; reuse same rebuild logic as similaritySearch
  if (!vectorStore) {
    if (rebuildPromise) {
      console.warn("Rebuild already in progress; awaiting existing rebuild...");
      await rebuildPromise;
    } else {
      console.warn("Vector store not initialized — attempting rebuild from disk...");
      rebuildPromise = (async () => {
        try {
          const rebuilt = await rebuildVectorStoreFromDisk();
          if (!rebuilt) throw new Error("No persisted docs available to rebuild vector store");
        } finally {
          rebuildPromise = null;
        }
      })();
      await rebuildPromise;
    }
  }

  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  // If query contains a date range, reuse date-aware logic but return all filtered candidates (no k slice)
  const dateRange = extractDateRangeFromQuery(query);
  if (dateRange) {
    const candidates = await vectorStore.similaritySearch(query, Math.max(candidateFetch, 100));

    const fromTs = dateRange.from.getTime();
    const toTs = dateRange.to.getTime();

    const filtered = candidates.filter(c => {
      const meta = c.metadata || {};
      let createdAtRaw = meta.createdAt || meta.created_at || meta.date || null;

      if (!createdAtRaw) {
        const pk = meta.pk ?? null;
        if (pk != null && sourceDocs?.length) {
          const found = sourceDocs.find(x => String(x.id) === String(pk) || String(x.id) === `posts_${String(pk)}`);
          if (found) createdAtRaw = found.createdAt || found.created_at || null;
        }
      }

      if (!createdAtRaw) return false;
      const created = new Date(createdAtRaw);
      if (isNaN(created.getTime())) return false;
      return created.getTime() >= fromTs && created.getTime() <= toTs;
    });

    // Map to rich docs and return
    const results = filtered.map(c => pickRichDocForCandidate(c));
    return results;
  }

  // Non-date path: fetch "candidateFetch" and map to rich docs (no top-k trimming)
  const candidates = await vectorStore.similaritySearch(query, candidateFetch);
  const results = candidates.map(c => pickRichDocForCandidate(c));
  return results;
}

export async function similaritySearch(query, k ) {
  if (!query) throw new Error("Query required");

  // ensure vector store exists; if not attempt serialized rebuild
  if (!vectorStore) {
    if (rebuildPromise) {
      console.warn("Rebuild already in progress; awaiting existing rebuild...");
      await rebuildPromise;
    } else {
      console.warn("Vector store not initialized — attempting rebuild from disk...");
      rebuildPromise = (async () => {
        try {
          const rebuilt = await rebuildVectorStoreFromDisk();
          if (!rebuilt) throw new Error("No persisted docs available to rebuild vector store");
        } finally {
          rebuildPromise = null;
        }
      })();
      await rebuildPromise;
    }
  }

  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  const dateRange = extractDateRangeFromQuery(query);

  if (!dateRange) {
    // fast path: get top-k from vector store
    const candidates = await vectorStore.similaritySearch(query, k);
    const results = candidates.map(c => pickRichDocForCandidate(c));
    return results;
  }

  // date-constrained path: fetch larger candidate set and post-filter by createdAt
  const candidateFetch = Math.max(k * 10, 100);
  const candidates = await vectorStore.similaritySearch(query, candidateFetch);

  const fromTs = dateRange.from.getTime();
  const toTs = dateRange.to.getTime();

  const filtered = candidates.filter(c => {
    const meta = c.metadata || {};
    let createdAtRaw = meta.createdAt || meta.created_at || meta.date || null;

    if (!createdAtRaw) {
      const pk = meta.pk ?? null;
      if (pk != null && sourceDocs?.length) {
        const found = sourceDocs.find(x => String(x.id) === String(pk) || String(x.id) === `posts_${String(pk)}`);
        if (found) createdAtRaw = found.createdAt || found.created_at || null;
      }
    }

    if (!createdAtRaw) return false;
    const created = new Date(createdAtRaw);
    if (isNaN(created.getTime())) return false;
    return created.getTime() >= fromTs && created.getTime() <= toTs;
  });

  const top = filtered.slice(0, k);
  const results = top.map(c => pickRichDocForCandidate(c));
  return results;
}


/* ------------------ DB → Docs ------------------ */

export async function docsFromDatabase(models = ["posts"], dateClause = "") {
  const docs = [];

  for (const model of models) {
    if (model === "posts") {
      const rows = JSON.parse(await db.run(
        `SELECT
            p.id,
            p.title,
            p.text,
            p.type,
            p.mainField,
            p.createdAt,
            COUNT(DISTINCT pl.user_id) AS LikesNumber,
            COUNT(DISTINCT pr.reply_id) AS RepliesNumber
         FROM posts p
         LEFT JOIN postlikes pl ON pl.post_id = p.id
         LEFT JOIN postreplies pr ON pr.post_id = p.id
         JOIN userposts up ON up.post_id = p.id
         JOIN users u ON u.id = up.user_id
         WHERE u.isFrozen = false ${dateClause}
         GROUP BY
            p.id,
            p.title,
            p.text,
            p.type,
            p.mainField,
            p.createdAt
         ORDER BY LikesNumber DESC, RepliesNumber DESC;`
      ));

      for (const r of rows) {
        const createdAt = (r.createdAt ? new Date(r.createdAt).toISOString() : null);
        const title = (r.title || "").toString();
        const likes = (r.LikesNumber != null ? Number(r.LikesNumber) : 0);
        const replies = (r.RepliesNumber != null ? Number(r.RepliesNumber) : 0);
        const bodyText = r.text || "";

        const pageContent = `Post: ${title}\nType: ${r.type || ""}\nMainField: ${r.mainField || ""}\nCreatedAt: ${createdAt || ""}\nLikes: ${likes}\nReplies: ${replies}\n\n${bodyText}`;

        const doc = {
          id: r.id, // keep original numeric id
          title,
          text: bodyText,
          type: r.type || null,
          mainField: r.mainField || null,
          createdAt,
          LikesNumber: likes,
          RepliesNumber: replies,
          metadata: {
            model: "posts",
            pk: r.id,
            title,
            createdAt,
            type: r.type || null,
            mainField: r.mainField || null,
            LikesNumber: likes,
            RepliesNumber: replies
          },
          pageContent
        };

        docs.push(doc);
      }
    }

    if (model === "users") {
      const rows = JSON.parse(await db.run(
        `SELECT id, username, bio, createdAt FROM users LIMIT 5000;`
      ));
      for (const r of rows) {
        docs.push({
          id: r.id,
          title: null,
          text: r.bio || "",
          type: "user_bio",
          mainField: null,
          createdAt: r.createdAt || null,
          LikesNumber: 0,
          RepliesNumber: 0,
          metadata: { model: "users", pk: r.id, username: r.username, createdAt: r.createdAt || null },
          pageContent: `User ${r.username}\n${r.bio || ""}`
        });
      }
    }
  }

  return docs;
}

/* ------------------ Startup helper ------------------ */

export async function initVectorStoreFromDiskIfPresent() {
  try {
    const rebuilt = await rebuildVectorStoreFromDisk();
    if (!rebuilt) {
      console.log("No persisted RAG docs found on disk at startup.");
    }
  } catch (err) {
    console.error("Error while initializing vector store from disk:", err);
  }
}
