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
  


  const apiKey = Variables.GG_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });
  
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
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
    const prompting = `User provided the data:
  topic: ${topic}
  content: ${content}
  hashtag: ${hashtag}
  
  Topic Analysis:
  _ Check if the given topic is related to IT.
  _ Return true if it is, otherwise false.
  
  Content Analysis:
  _ Check if the provided content is relevant to the specific field indicated by the topic (not just general IT).
  _ Return true if it matches the field of the topic, otherwise false.
  
  Hashtag Analysis:
  _ Check if the provided hashtags relate to the same specific field as the topic.
  _ Return true if they match, otherwise false.
  
  Finally, give me an object that represents the analysis:
  {
    topic: true or false,
    content: true or false,
    hashtag: true or false
  }`;
  
    const chatSession = model.startChat({
      generationConfig,
      safetySetting,
      history: [],
    });
  
    const result = await chatSession.sendMessage(prompting);
    const responseText = await result.response.text();
  
    // Extract JSON object from response text
    const jsonMatch = responseText.match(/{[\s\S]*}/);
    if (jsonMatch && jsonMatch[0]) {
      const jsonString = jsonMatch[0];
      try {
        const analysis = JSON.parse(jsonString);
        return analysis;
      } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
      }
    } else {
      console.error("JSON object not found in response:", responseText);
      return null;
    }
  }

  async function Taxonomy(topic) {
    const prompting = `I have the Taxonomy of IT-Related Fields:
    Core Infrastructure & Operations
    Software & Application Development
    Data & Intelligence
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
    Data & Intelligence
    Security & Operations Management
    Emerging Technologies

    Read the script below and only answer the name of taxonomy or the empty string "": 

    I have the user information in form of json (sometime the user is a new user and position or bio of them maybe is null or empty string):
    ${JSON.stringify(userInfo, null, 2)}


    I have 10 or fewer user-generated posts in the most recent time (each post in form of json object):
    ${JSON.stringify(userPosts, null, 2)}


    Give me the suggestion about their interesting, their trending that is one of 5 Taxonomy of IT-Related Fields that i provided. (only give me the answer that is the name of one taxonomy)
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