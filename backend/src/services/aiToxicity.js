// src/services/aiToxicity.js
import ollama from "ollama";

/**
 * analyzeToxicityLevel using local Ollama LLM.
 * - Expects Ollama running at OLLAMA_HOST (default: http://localhost:11434)
 * - Uses model from OLLAMA_MODEL (default: llama3.2)
 *
 * New scale:
 * 0 => Not toxic / acceptable (includes constructive criticism, insults/harsh words considered tolerable for community context)
 * 1 => Extremely toxic: severe insults, explicit threats, hate speech, sexual harassment, explicit calls to violence — hide/ban.
 *
 * Returns { level: 0|1, explanation: string }
 *
 * Fail-safe: on any error returns heuristic result (prefer safe = 0 unless severe terms found).
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

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

// local heuristic fallback (maps to new 0/1 scale)
function heuristicFromText(text) {
  const lower = String(text || "").toLowerCase();

  // severe indicators -> level 1
  const severe = ["nigger", "faggot", "slur"]; // explicit slurs / extremely abusive language
  const threats = ["kill", "i will kill", "i'll kill", "i will hurt you", "i'll hurt you", "die", "rape", "i will rape"];
  // milder obscene/insulting language treated as acceptable (0) under the new scheme
  if (severe.some(s => lower.includes(s)) || threats.some(s => lower.includes(s))) {
    return { level: 1, explanation: "contains severe slur or explicit threat" };
  }
  // default: not extremely toxic
  return { level: 0, explanation: "no clear extreme toxicity detected" };
}

export async function analyzeToxicityLevel(content, context = {}, timeoutMs = 60000) {
  if (!content || content.trim().length === 0) {
    return { level: 0, explanation: "empty-content" };
  }

  // Build prompt that *requires* valid JSON only
  const safeContent = content.replace(/"""/g, '\\"""');
  const questionSnippet = context.question
    ? `Question title: "${(context.question.title || "").replace(/"/g, '\\"')}"\nQuestion body: "${(context.question.content || "").replace(/"/g, '\\"')}"`
    : "";
  const threadSnippet = context.thread
    ? `Thread title: "${(context.thread.title || "").replace(/"/g, '\\"')}"${context.thread.forumTitle ? `\nForum: "${(context.thread.forumTitle || "").replace(/"/g, '\\"')}"` : ""}`
    : "";

  const systemMessage = `
You are a technical forum moderator. Your ONLY job is to separate personal attacks from blunt technical feedback.

CRITICAL RULE: 
- Level 0: Criticism of the WORK, the CODE, the POST effort, or the QUALITY of the post. (e.g., "This is a bad question", "This question is lazy", "This code is terrible", "This is a dumb approach").
- Level 1: Criticism of the HUMAN, slurs, threats, or useless swearing. (e.g., "You are lazy", "You are bad", "You are an idiot", "Fuck you").

EXAMPLES:
- "This is a bad question" -> {"level": 0, "explanation": "Criticism of the post quality, not the person."}
- "This code is garbage" -> {"level": 0, "explanation": "Criticism of the work product."}
- "You are a garbage developer" -> {"level": 1, "explanation": "Direct personal attack on the user's identity."}

Analyze the following content and respond in VALID JSON ONLY: {"level": 0|1, "explanation": "string"}
`;

  try {
    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: safeContent }
    ];

    const chatPromise = ollama.chat({
      model: OLLAMA_MODEL,
      baseUrl: OLLAMA_HOST,
      options: {
        num_ctx: 2048,
        temperature: 0,
      },
      messages,
    });

    const result = await withTimeout(chatPromise, timeoutMs);
    const txtRaw = (result?.message?.content || "").trim();

    // Helper: attempt to extract JSON substring
    function extractJson(text) {
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        const sub = text.slice(first, last + 1);
        try {
          return JSON.parse(sub);
        } catch (e) {
          // fallthrough
        }
      }
      return null;
    }

    let parsed = extractJson(txtRaw);

    if (!parsed) {
      // attempt loose parse e.g. "level: 2 explanation: ..."
      const levelMatch = txtRaw.match(/level\s*[:=]\s*([0-9])/i);
      const explMatch = txtRaw.match(/explanation\s*[:=]\s*["']([^"']+)["']/i) || txtRaw.match(/"(.*?)"/);
      if (levelMatch) {
        parsed = { level: parseInt(levelMatch[1], 10), explanation: explMatch ? (explMatch[1].trim()) : (txtRaw.slice(0, 200).trim()) };
      }
    }

    if (parsed && typeof parsed.level === "number") {
      // Accept either model returning 0/1 (new) or legacy 1/2/3 (old).
      let rawLevel = Math.floor(parsed.level);
      let level;
      if (rawLevel === 0 || rawLevel === 1) {
        level = rawLevel;
      } else {
        // legacy mapping: 1 or 2 -> 0 (not extreme), 3 -> 1 (extreme)
        level = (rawLevel >= 3) ? 1 : 0;
      }

      const explanation = parsed.explanation ? String(parsed.explanation).trim().slice(0, 1000) : "no-explanation-provided";
      return { level, explanation };
    }

    // fallback heuristics on assistant text
    const lower = txtRaw.toLowerCase();
    if (/\b(threat|kill|rape|i will|i'll|die)\b/.test(lower) || /\b(nigger|faggot|slur)\b/.test(lower)) {
      return { level: 1, explanation: "contains severe abusive language or threats" };
    }

    // default safe (not extreme)
    return { level: 0, explanation: "no clear extreme toxicity detected" };
  } catch (err) {
    console.error("analyzeToxicityLevel (Ollama) error:", err && err.message ? err.message : err);
    // fail-safe fallback to heuristic (do not ban on model error unless clear severe terms)
    try {
      return heuristicFromText(content);
    } catch (e) {
      return { level: 0, explanation: "ai-check-failed-or-unclear" };
    }
  }
}
