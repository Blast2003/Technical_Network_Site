import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Variables } from "../config/variables.js";

const apiKey = Variables.GG_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 0,
  topP: 1,
  topK: 1,
  maxOutputTokens: 64,
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

/**
 * Analyze a free‐form user input and determine which (if any)
 * IT‐Related Field taxonomy it corresponds to.
 *
 * @param {string} userInput - The user’s question or statement.
 * @returns {Promise<string>} - A promise resolving to either
 *   the taxonomy name or an empty string.
 */
async function analyzeInputTaxonomy(userInput) {
  const prompt = `
You have these five IT-Related Field taxonomies:
- Core Infrastructure & Operations
- Software & Application Development
- Data & Intelligence
- Security & Operations Management
- Emerging Technologies

Given this single user input (in plain text):
"${userInput}"

Return only the string containing exactly one of the taxonomy names above if the user's input clearly relates to it, or only return "Emerging Technologies" if none apply. Don't be allowed to output anything else.
`;

  const chat = model.startChat({
    generationConfig,
    safetySetting,
    history: [],
  });

  const result = await chat.sendMessage(prompt.trim());
  const response = await result.response.text();

  // The model should reply exactly with one taxonomy or ""
  return response.trim();
}

export default analyzeInputTaxonomy ;
