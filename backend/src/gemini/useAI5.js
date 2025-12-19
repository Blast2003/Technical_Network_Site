// utils/useAI5.js (updated prompt — no IDs, stronger attribution)
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Variables } from "../config/variables.js";

const apiKey = Variables.GG_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

const generationConfig = {
  temperature: 0.2, // lower temperature for stable summaries
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 512,
  responseMimeType: "text/plain",
};

const safetySetting = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

// timeout helper
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * SummarizeAnswers
 * - thread: { id, title }
 * - question: { id, title, content }
 * - answers: [{ content, senderName, senderRole, parentType, parentSenderName, createdAt }, ...] (max 10)
 *
 * Returns a plain text summary. Throws on error.
 */
export async function SummarizeAnswers({ thread, question, answers = [], timeoutMs = 10000 } = {}) {
  if (!question || !answers || answers.length === 0) throw new Error("No answers provided for summarization");

  // Build compact prompt that intentionally never includes numeric answer IDs.
  let prompt = `You are a professional assistant that summarizes recent answers in a Q&A forum.

Thread title: ${thread?.title || "Unknown thread"}
Question title: ${question?.title || ""}${question?.content ? `\nQuestion details: ${question.content}` : ""}

We give you up to ${answers.length} recent answers (most recent first) that were created within the last 24 hours.
For each answer we provide: the sender's username, the sender's forum role (if available), whether the entry is a direct answer to the question or a reply to another user's answer, and a short snippet of the content.

Important:
- **Do NOT** mention or output any numeric or database IDs.
- **Always** use the sender's username and role when summarizing a direct answer or a distinct key point (for example: "Answer by **Alice (forum_admin)**").
- If an answer is a reply, reference the parent by the parent sender's username (for example: "Reply to an answer by **Bob**").
- If you can derive **theme titles directly from the answers**, group similar replies into **2-4 short themes** and give each theme a short title followed by **3-6 concise bullet points** (each bullet <= 20 words). **Only** create theme titles when they are clearly supported by the content.
- **Otherwise**, do **not** invent theme titles. Instead, list the most important **3-6 concise bullets** (each <= 20 words) that capture the key points across the answers without adding new headings. **Each bullet must clearly attribute the key point to the sender(s) when summarizing a distinct answer or suggestion.**
- Emphasize disagreements or distinct viewpoints briefly (e.g., "Two perspectives: A vs B").
- Keep the summary professional, concise and readable.
- Use **double-asterisk** for bold emphasis around keywords.
- Finish with one short recommended next action as a single sentence, prefixed exactly with: **Recommended next action:**

Answers (most recent first):
`;

  for (const a of answers) {
    const sender = a.senderName || "Anonymous";
    const rolePart = a.senderRole ? ` (${a.senderRole})` : "";
    const type = a.parentType === "reply"
      ? `Reply to an answer by ${a.parentSenderName || "another user"}`
      : "Direct answer to the question";
    // Keep content trimmed to limit tokens
    const snippet = (a.content || "").trim().replace(/\n+/g, " ").slice(0, 1200);
    prompt += `\n- sender: ${sender}${rolePart}\n type: ${type}\n content: ${snippet}\n`;
  }

  prompt += `\nWrite the summary now. Keep it clear, professional, and highlight important keywords with **bold**. Do not include any numeric ids or database references.`;

  try {
    const chatSession = model.startChat({
      generationConfig,
      safetySetting,
      history: [],
    });

    const result = await withTimeout(chatSession.sendMessage(prompt), timeoutMs);
    const responseText = await result.response.text();
    return responseText;
  } catch (err) {
    console.error("SummarizeAnswers AI error:", err);
    throw err;
  }
}