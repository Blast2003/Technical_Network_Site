// DefineUserInputFromTaxonomy.js
import ollama from "ollama";

/**
 * Analyze a free-form user input and determine which (if any)
 * IT-Related Field taxonomy it corresponds to.
 *
 * Returns the exact taxonomy name (one of the six) or an empty string.
 */

// Ollama config (env overrides)
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const DEFAULT_TIMEOUT_MS = 30_000;

// Allowed taxonomy names (exact strings)
const ALLOWED_TAXONOMIES = [
  "Core Infrastructure & Operations",
  "Software & Application Development",
  "Data Engineering & Management",
  "Artificial Intelligence & Analytics",
  "Security & Operations Management",
  "Emerging Technologies",
];

// small timeout wrapper
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Local heuristic fallback based on keywords
function heuristicFromText(text) {
  if (!text || !text.trim()) return "";

  const lower = text.toLowerCase();

  const buckets = [
    {
      taxonomy: "Core Infrastructure & Operations",
      keywords: ["infrastructure", "network", "server", "datacenter", "ops", "sysadmin", "kubernetes", "containers", "linux", "windows server"],
    },
    {
      taxonomy: "Software & Application Development",
      keywords: ["software", "application", "app", "frontend", "backend", "api", "development", "programming", "deploy", "framework", "library", "react", "node", "java", "python"],
    },
    {
      taxonomy: "Data Engineering & Management",
      keywords: ["data engineering", "etl", "data pipeline", "warehouse", "database", "sql", "nosql", "big data", "spark", "airflow", "data management", "data lake"],
    },
    {
      taxonomy: "Artificial Intelligence & Analytics",
      keywords: ["ai", "machine learning", "ml", "model", "deep learning", "neural", "analytics", "data science", "prediction", "training", "inference"],
    },
    {
      taxonomy: "Security & Operations Management",
      keywords: ["security", "vulnerability", "cve", "threat", "pen test", "compliance", "audit", "secops", "iam", "encryption", "incident response"],
    },
    {
      taxonomy: "Emerging Technologies",
      keywords: ["blockchain", "web3", "iot", "quantum", "augmented reality", "virtual reality", "vr", "ar", "edge computing", "emerging", "novel"],
    },
  ];

  // Score each bucket by occurrences
  const scores = buckets.map((b) => {
    let score = 0;
    for (const kw of b.keywords) {
      if (lower.includes(kw)) score += 1;
    }
    return { taxonomy: b.taxonomy, score };
  });

  // Choose highest score if it is non-zero and unambiguous
  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score === 0) return "";
  // Check tie (ambiguity) - require a clear lead
  if (scores[1] && scores[0].score === scores[1].score) return "";
  return scores[0].taxonomy;
}

// Try to extract one of the exact taxonomy strings from model text
function findExactTaxonomyInText(text) {
  if (!text) return null;
  const trimmed = text.trim();
  // direct exact match
  for (const t of ALLOWED_TAXONOMIES) {
    if (trimmed === t) return t;
  }
  // if model returned JSON like {"taxonomy":"..."}
  try {
    const maybe = JSON.parse(trimmed);
    if (maybe && typeof maybe === "object") {
      // try common keys
      for (const key of ["taxonomy", "result", "label", "category"]) {
        if (typeof maybe[key] === "string") {
          const val = maybe[key].trim();
          const match = ALLOWED_TAXONOMIES.find((tt) => tt.toLowerCase() === val.toLowerCase());
          if (match) return match;
        }
      }
    }
  } catch (e) {
    // ignore JSON parse errors
  }

  // find substring match of any allowed taxonomy (case-insensitive)
  for (const t of ALLOWED_TAXONOMIES) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) return t;
  }

  // sometimes LLM responds with short phrases, try normalized match
  const lowered = text.toLowerCase();
  for (const t of ALLOWED_TAXONOMIES) {
    if (lowered.includes(t.toLowerCase())) return t;
  }

  return null;
}

/**
 * Main exported function.
 * @param {string} userInput
 * @param {object} [opts] optional: { timeoutMs }
 * @returns {Promise<string>} taxonomy name or empty string
 */
export async function analyzeInputTaxonomy(userInput, opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (!userInput || !String(userInput).trim()) {
    return "";
  }

  // Escape triple quotes that could break the prompt
  const safeInput = String(userInput).replace(/"""/g, '\\"""').trim();

  const systemMessage = `
You have these six IT-Related Field taxonomies:
- Core Infrastructure & Operations
- Software & Application Development
- Data Engineering & Management
- Artificial Intelligence & Analytics
- Security & Operations Management
- Emerging Technologies

Given this single user input (in plain text):
"${safeInput}"

Return ONLY ONE THING and NOTHING ELSE:
- Either exactly one of the taxonomy names above (match exact capitalization and spacing), OR
- an empty string (i.e. return nothing) if none apply.

Do NOT output any other commentary, JSON wrappers, code fences, or explanation. Respond with exactly one line containing the taxonomy name or an empty string.
`.trim();

  // Messages: system + a user message that repeats the input (helps some models)
  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: safeInput },
  ];

  try {
    const chatPromise = ollama.chat({
      model: OLLAMA_MODEL,
      baseUrl: OLLAMA_HOST,
      options: {
        num_ctx: 2048,
        // temperature 0 to be deterministic
        temperature: 0,
      },
      messages,
    });

    const result = await withTimeout(chatPromise, timeoutMs);
    const txtRaw = (result?.message?.content || "").trim();

    // Try to extract exact taxonomy from text
    const found = findExactTaxonomyInText(txtRaw);
    if (found !== null) {
      return found;
    }

    // If the model returned an obvious blank-like thing
    if (!txtRaw || txtRaw === '""' || /^none$/i.test(txtRaw) || /^no$/i.test(txtRaw) || /^not applicable$/i.test(txtRaw)) {
      return "";
    }

    // If we couldn't find an exact taxonomy, attempt a looser extraction:
    // If the model produced a short answer, try to map common words to taxonomies.
    const heuristic = heuristicFromText(txtRaw);
    if (heuristic) {
      return heuristic;
    }

    // Final fallback: run heuristic on original userInput
    const fallback = heuristicFromText(userInput);
    if (fallback) {
      return fallback;
    }

    // If nothing reliable, return empty string (safe default)
    return "";
  } catch (err) {
    // Log error server-side for debugging, but keep safe behavior
    // eslint-disable-next-line no-console
    console.error("analyzeInputTaxonomy (Ollama) error:", err && err.message ? err.message : err);

    // Try heuristic on user input as fail-safe
    try {
      const fallback = heuristicFromText(userInput);
      return fallback || "";
    } catch (e) {
      return "";
    }
  }
}

export default analyzeInputTaxonomy;
