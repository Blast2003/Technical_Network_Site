// utils/useAI2.js
/* dùng ES module - chỉnh path nếu cần */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Variables } from "../config/variables.js"; 

const apiKey = Variables.GG_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 512, // giảm token để nhanh hơn và rẻ hơn
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
 * AnalyzeUserTrendingForUserRecommendation
 * - userInfo: user object (may contain null fields)
 * - userPosts: array of up to 5 recent posts
 * - options: { timeoutMs }
 *
 * Throws on error so callers (controllers) can fallback.
 */
async function AnalyzeUserTrendingForUserRecommendation(userInfo, userPosts, { timeoutMs = 3500 } = {}) {
  const prompting = `I have the Taxonomy of IT-Related Fields:
Core Infrastructure & Operations
Software & Application Development
Data & Intelligence
Security & Operations Management
Emerging Technologies

Read the script below: 

I have the user information in form of json (sometime the user is a new user and position or bio of them maybe is null or empty string):
${JSON.stringify(userInfo, null, 2)}

I have 5 or fewer user-generated posts in the most recent time (each post in form of json object):
${JSON.stringify(userPosts, null, 2)}

Give me the suggestion about their interesting, their trending that is one of 5 Taxonomy of IT-Related Fields that i provided. (only give me the answer that is the name of one taxonomy)
If the user information (in form of json) don't have or equal null and the user have not created any posts before (user-generated posts is empty array or null). (only give me the answer that is empty string "").
Only return the answer is the name of only one taxonomy or the empty string ""`;

  try {
    const chatSession = model.startChat({
      generationConfig,
      safetySetting,
      history: [],
    });

    // wrap sendMessage with timeout to avoid long blocking
    const result = await withTimeout(chatSession.sendMessage(prompting), timeoutMs);
    const responseText = await result.response.text();
    return responseText;
  } catch (err) {
    console.error("AI analyze error:", err.message);
    throw err;
  }
}

export { AnalyzeUserTrendingForUserRecommendation };
