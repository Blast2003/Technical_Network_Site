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
    model: "mxbai-embed-large",
    baseUrl: "http://localhost:11434"
  });
}

/* ------------------ Date parsing helpers ------------------ */

/**
 * Parse a user query for date expressions and return a { from: Date, to: Date }
 * or null if none found.
 *
 * Supported patterns (examples):
 *  - "today", "yesterday"
 *  - "last 7 days", "past 2 months", "in the last 3 years"
 *  - "this week", "this month", "this year"
 *  - "since 2024-01-01"
 *  - "between 2023-01-01 and 2023-03-31"
 *  - "2 years ago" (interpreted as the whole year: start of year-2 → end of year-2)
 *  - "2 months ago" (interpreted as the whole month two months back)
 */
function extractDateRangeFromQuery(input) {
  if (!input || typeof input !== "string") return null;
  const lower = input.toLowerCase();

  const now = new Date();

  // helpers
  const startOfDay = d => {
    const x = new Date(d);
    x.setHours(0,0,0,0);
    return x;
  };
  const endOfDay = d => {
    const x = new Date(d);
    x.setHours(23,59,59,999);
    return x;
  };
  const startOfMonth = (y, m) => new Date(y, m, 1, 0, 0, 0, 0);
  const endOfMonth = (y, m) => new Date(y, m + 1, 0, 23, 59, 59, 999);
  const startOfYear = y => new Date(y, 0, 1, 0, 0, 0, 0);
  const endOfYear = y => new Date(y, 11, 31, 23, 59, 59, 999);
  const startOfWeekMonday = d => {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // 0=Mon, ... 6=Sun
    const s = new Date(date);
    s.setDate(date.getDate() - day);
    s.setHours(0,0,0,0);
    return s;
  };

  // 1) today
  if (/\btoday\b/.test(lower)) {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  // 2) yesterday
  if (/\byesterday\b/.test(lower)) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }

  // 3) last / past N units (e.g. last 2 months | past 7 days)
  const agoRange = lower.match(/\b(?:last|past|in the last)\s+(\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/);
  if (agoRange) {
    let [, num, unit] = agoRange;
    num = Number(num);
    unit = unit.replace(/s$/,'');
    const to = new Date();
    const from = new Date();
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

  // 4) "this week/month/year"
  const thisPeriod = lower.match(/\bthis (week|month|year)\b/);
  if (thisPeriod) {
    const p = thisPeriod[1];
    if (p === 'week') return { from: startOfWeekMonday(now), to: endOfDay(now) };
    if (p === 'month') return { from: startOfMonth(now.getFullYear(), now.getMonth()), to: endOfDay(now) };
    if (p === 'year') return { from: startOfYear(now.getFullYear()), to: endOfDay(now) };
  }

  // 5) since YYYY-MM-DD
  const since = lower.match(/\bsince\s+(\d{4}-\d{2}-\d{2})\b/);
  if (since) {
    const d = new Date(since[1] + "T00:00:00");
    return { from: startOfDay(d), to: endOfDay(now) };
  }

  // 6) between YYYY-MM-DD and YYYY-MM-DD
  const between = lower.match(/\bbetween\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})\b/);
  if (between) {
    const a = new Date(between[1] + "T00:00:00");
    const b = new Date(between[2] + "T23:59:59");
    return { from: startOfDay(a), to: endOfDay(b) };
  }

  // 7) "N units ago" interpreted as whole unit period N units back:
  //     "2 years ago" => entire year (currentYear - 2)
  //     "3 months ago" => that month: (currentMonth - 3)
  const agoExact = lower.match(/\b(\d+)\s+(years?|months?|weeks?|days?)\s+ago\b/);
  if (agoExact) {
    const n = Number(agoExact[1]);
    const unit = agoExact[2].replace(/s$/,'');
    if (unit === 'year') {
      const year = now.getFullYear() - n;
      return { from: startOfYear(year), to: endOfYear(year) };
    }
    if (unit === 'month') {
      const date = new Date(now);
      date.setMonth(now.getMonth() - n);
      const y = date.getFullYear();
      const m = date.getMonth();
      return { from: startOfMonth(y, m), to: endOfMonth(y, m) };
    }
    if (unit === 'week') {
      const date = new Date(now);
      date.setDate(now.getDate() - (n * 7));
      return { from: startOfWeekMonday(date), to: endOfDay(new Date(date.setDate(date.getDate() + 6))) };
    }
    if (unit === 'day') {
      const date = new Date(now);
      date.setDate(now.getDate() - n);
      return { from: startOfDay(date), to: endOfDay(date) };
    }
  }

  // no date patterns found
  return null;
}

/* ------------------ Vector Store ------------------ */

/**
 * Build an in-memory vector store from `docs`.
 * @param {Array} docs - array of { id, text, metadata }
 * @param {Object} options
 * @param {boolean} options.persist - whether to save the `docs` JSON to disk (default: true)
 */
export async function buildVectorStoreFromDocs(docs, { persist = true } = {}) {
  if (!docs?.length) throw new Error("No documents to index");

  // create embeddings client
  const embeddings = createEmbeddings();

  // create a fresh in-memory store and add documents in batches
  vectorStore = new MemoryVectorStore(embeddings);

  const BATCH_SIZE = 100;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);

    await vectorStore.addDocuments(
      batch.map(d => ({
        pageContent: d.text,
        metadata: d.metadata
      }))
    );

    console.log(`Indexed ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }

  sourceDocs = docs;

  if (persist) {
    try {
      saveSourceDocsToDisk(docs);
    } catch (err) {
      console.warn("Failed to save source docs to disk:", err);
    }
  }
}

/**
 * Rebuild vector store from disk (builds in-memory index, but does NOT re-save the JSON).
 */
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
 *  - if no date detected in query -> normal vector search
 *  - if date detected -> fetch larger candidate set, post-filter by metadata.createdAt,
 *    then return top-k filtered results.
 */
export async function similaritySearch(query, k = 5) {
  if (!query) throw new Error("Query required");

  // ensure vector store exists. If not, attempt rebuild (serialized).
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

  // try to extract date range from query
  const dateRange = extractDateRangeFromQuery(query);

  // If no date constraints, simple fast path
  if (!dateRange) {
    const docs = await vectorStore.similaritySearch(query, k);
    return docs.map(d => ({
      pageContent: d.pageContent,
      metadata: d.metadata
    }));
  }

  // If date constraints exist, fetch a larger candidate set, then post-filter by createdAt
  const candidateFetch = Math.max(k * 10, 100); // tune as needed
  const candidates = await vectorStore.similaritySearch(query, candidateFetch);

  const fromTs = dateRange.from.getTime();
  const toTs = dateRange.to.getTime();

  const filtered = candidates.filter(d => {
    // metadata.createdAt should exist: try multiple shapes
    const meta = d.metadata || {};
    const createdAtRaw = meta.createdAt || meta.created_at || meta.date || null;
    if (!createdAtRaw) return false;
    const created = new Date(createdAtRaw);
    if (isNaN(created.getTime())) return false;
    const t = created.getTime();
    return t >= fromTs && t <= toTs;
  });

  // pick top-k filtered
  const result = filtered.slice(0, k).map(d => ({
    pageContent: d.pageContent,
    metadata: d.metadata
  }));

  // If not enough results, return what we have (could optionally fallback to DB filter)
  return result;
}

/* ------------------ DB → Docs ------------------ */

export async function docsFromDatabase(models = ["posts"]) {
  const docs = [];

  for (const model of models) {
    if (model === "posts") {
      const rows = JSON.parse(await db.run(
        `SELECT id, title, text, mainField, createdAt FROM posts LIMIT 500;`
      ));
      for (const r of rows) {
        // include title and createdAt in both page text and metadata (so both vectors and filters can use them)
        const createdAt = (r.createdAt ? String(r.createdAt) : null);
        const title = (r.title || "").toString();
        docs.push({
          id: `posts_${r.id}`,
          // include title and createdAt text to help embeddings (optional)
          text: `Post: ${title}\nCreatedAt: ${createdAt || ""}\n${r.text || ""}`,
          metadata: { model: "posts", pk: r.id, title, createdAt }
        });
      }
    }

    if (model === "users") {
      const rows = JSON.parse(await db.run(
        `SELECT id, username, bio FROM users LIMIT 5000;`
      ));
      for (const r of rows) {
        docs.push({
          id: `users_${r.id}`,
          text: `User ${r.username}: ${r.bio || ""}`,
          metadata: { model: "users", pk: r.id }
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
