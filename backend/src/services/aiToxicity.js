// src/services/aiToxicity.js
import ollama from "ollama";

/**
 * analyzeToxicityLevel using local Ollama LLM.
 * - Expects Ollama running at OLLAMA_HOST (default: http://localhost:11434)
 * - Uses model from OLLAMA_MODEL (default: llama3.2)
 *
 * Returns { level: 1|2|3, explanation: string }
 *
 * Fail-safe: on any error returns { level: 1, explanation: "ai-check-failed-or-unclear" }
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

// local heuristic fallback (keeps same rules as previous versions)
function heuristicFromText(text) {
  const lower = String(text || "").toLowerCase();
  const severe = ["nigger", "faggot", "slur"];
  const obscene = ["fuck", "shit", "damn", "bitch", "bastard"];
  const threats = ["kill", "i will kill", "i'll kill", "die", "i will hurt you", "i'll hurt you"];
  const insults = ["stupid", "idiot", "moron", "you suck", "dumb"];
  const identity = ["brown people", "muslims", "jews", "black people", "gays"];

  if (severe.some(s => lower.includes(s)) || threats.some(s => lower.includes(s))) {
    return { level: 3, explanation: "contains severe slur or explicit threat" };
  }
  if (obscene.some(s => lower.includes(s)) || insults.some(s => lower.includes(s)) || identity.some(s => lower.includes(s))) {
    return { level: 2, explanation: "insulting or obscene language detected" };
  }
  return { level: 1, explanation: "no clear toxicity detected" };
}

export async function analyzeToxicityLevel(content, context = {}, timeoutMs = 60000) {
  if (!content || content.trim().length === 0) {
    return { level: 1, explanation: "empty-content" };
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
You are a toxicity classifier used by a forum. You MUST respond with VALID JSON ONLY (no surrounding commentary or markdown).
Return exactly an object with two keys:
- "level": an integer 1, 2, or 3
- "explanation": a short string (one or two sentences) that justifies the level.

Definitions:
1 => Not toxic / acceptable. Constructive criticism, neutral or polite language, inoffensive jokes.
2 => Medium toxic but contextually acceptable: insults or harsh words but not severe threats/hate. Show to users but flag for moderator review.
3 => Extremely toxic: severe insults, threats, hate speech, sexual harassment, or explicit calls to violence — hide / ban.

Use the following context when deciding:
${threadSnippet ? threadSnippet + "\n" : ""}${questionSnippet ? questionSnippet + "\n" : ""}

Now analyze the following answer text and return JSON only:

Answer text:
"""${safeContent}"""
`;

  try {
    // Make the Ollama chat call
    const messages = [
      { role: "system", content: systemMessage },
      // place the content in a user message as well for some models that prefer it
      { role: "user", content: safeContent }
    ];

    const chatPromise = ollama.chat({
      model: OLLAMA_MODEL,
      baseUrl: OLLAMA_HOST,
      options: {
        // tune these as needed
        num_ctx: 2048,
        temperature: 0,
      },
      messages,
    });

    const result = await withTimeout(chatPromise, timeoutMs);
    // Ollama response shape in your environment: response.message.content (as in your snippet)
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
          // fallthrough to heuristics
        }
      }
      return null;
    }

    let parsed = extractJson(txtRaw);

    if (!parsed) {
      // attempt loose parse e.g. "level: 2 explanation: ..."
      const levelMatch = txtRaw.match(/level\s*[:=]\s*([123])/i);
      const explMatch = txtRaw.match(/explanation\s*[:=]\s*["']([^"']+)["']/i) || txtRaw.match(/"(.*?)"/);
      if (levelMatch) {
        parsed = { level: parseInt(levelMatch[1], 10), explanation: explMatch ? (explMatch[1].trim()) : (txtRaw.slice(0, 200).trim()) };
      }
    }

    if (parsed && typeof parsed.level === "number") {
      const level = Math.min(3, Math.max(1, Math.floor(parsed.level)));
      const explanation = parsed.explanation ? String(parsed.explanation).trim().slice(0, 1000) : "no-explanation-provided";
      return { level, explanation };
    }

    // fallback heuristics looking at assistant text
    const lower = txtRaw.toLowerCase();
    if (/\b(threat|kill|rape|i will|die)\b/.test(lower) || /\b(nigger|faggot|slur)\b/.test(lower)) {
      return { level: 3, explanation: "contains severe abusive language or threats" };
    }
    if (/\b(stupid|idiot|dumb|you suck|moron)\b/.test(lower)) {
      return { level: 2, explanation: "insulting language detected but not extreme" };
    }

    // default safe if nothing found
    return { level: 1, explanation: "no clear toxicity detected" };
  } catch (err) {
    console.error("analyzeToxicityLevel (Ollama) error:", err && err.message ? err.message : err);
    // fail-safe fallback to heuristic (do not ban on model error)
    try {
      return heuristicFromText(content);
    } catch (e) {
      return { level: 1, explanation: "ai-check-failed-or-unclear" };
    }
  }
}
