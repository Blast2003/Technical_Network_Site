/*
 * Install the Generative AI SDK
 *
 * $ npm install @google/generative-ai
 *
 * See the getting started guide for more information
 * https://ai.google.dev/gemini-api/docs/get-started/node
 */

import {GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,} from "@google/generative-ai"
import { Variables } from "../config/variables.js";
  


  const apiKey = Variables.GG_API_KEY1;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
  });
  
  const generationConfig = {
    temperature: 0,
    topP: 0.1,
    topK: 10,
    maxOutputTokens: 8192,
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
  
  async function analyzePost(topic, content, hashtag) {
  const prompting = `
    You are a strict IT Content Validator. 
    
    VALID IT DOMAINS: 
    Software Development, Hardware, Cybersecurity, Networking, Data Science/Mining, 
    AI/ML, Cloud Computing, DevOps, IT Support, Database Management.

    EVALUATION RULES:
    1. "topic" is TRUE if the input Topic belongs to the VALID IT DOMAINS list or is a technical sub-field of IT.
    2. "content" is TRUE ONLY if it is related to the specific Topic provided.
    3. "hashtag" is TRUE ONLY if it is related to the specific Topic provided.

    SCENARIO ANALYSIS:
    - If Topic is "Data Mining" and Content is "Cooking": 
      Result: { "topic": true, "content": false, "hashtag": false }
    
    USER DATA:
    Topic: "${topic}"
    Content: "${content}"
    Hashtag: "${hashtag}"

    Return ONLY a JSON object:
    {
      "topic": boolean,
      "content": boolean,
      "hashtag": boolean
    }`;

  const chatSession = model.startChat({
      generationConfig,
      safetySetting,
      history: [],
  });

  const result = await chatSession.sendMessage(prompting);
  let responseText = await result.response.text();

  try {
    // If you set responseMimeType to "application/json", 
    // you might not need the regex, but it's safe to keep as a backup.
    const jsonMatch = responseText.match(/{[\s\S]*}/);
    const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    return analysis;
  } catch (error) {
    console.error("Parsing error:", error);
    return null;
  }
}

  async function Taxonomy(topic) {
    const prompting = `I have the Taxonomy of IT-Related Fields:
    Core Infrastructure & Operations
    Software & Application Development
    Data Engineering & Management
    Artificial Intelligence & Analytics
    Security & Operations Management
    Emerging Technologies

I have the topic "${topic}", which is the Taxonomy of IT-Related Fields that the topic belongs to. (only give me the answer that is the name of one taxonomy)`;
  
    const chatSession = model.startChat({
      generationConfig,
      safetySetting,
      history: [],
    });
  
    const result = await chatSession.sendMessage(prompting);
    const responseText = await result.response.text();
  
    return responseText;
  }

  async function AnalyzeUserTrending(userInfo, userPosts) {

    

    const prompting = `I have the Taxonomy of IT-Related Fields:
    Core Infrastructure & Operations
    Software & Application Development
    Data Engineering & Management
    Artificial Intelligence & Analytics
    Security & Operations Management
    Emerging Technologies

    Read the script below and only answer the name of taxonomy or the empty string "": 

    I have the user information in form of json (sometime the user is a new user and position or bio of them maybe is null or empty string):
    ${JSON.stringify(userInfo, null, 2)}


    I have 10 or fewer user-generated posts in the most recent time (each post in form of json object):
    ${JSON.stringify(userPosts, null, 2)}


    Give me the suggestion about their interesting, their trending that is one of 6 Taxonomy of IT-Related Fields that i provided. (only give me the answer that is the name of one taxonomy)
    If the user information (in form of json) don't have or equal null and the user have not created any posts before (user-generated posts is empty array or null). (only give me the answer that is empty string).`;
    

    // console.log(prompting)

    const chatSession = model.startChat({
      generationConfig,
      safetySetting,
      history: [],
    });
  
    const result = await chatSession.sendMessage(prompting);
    const responseText = await result.response.text();
  
    return responseText;
  }
  
  export {analyzePost, Taxonomy, AnalyzeUserTrending};