import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import ollama from 'ollama';


const conversations = {};


function getKnowledgeContent() {
    try {
      return fs.readFileSync(
        'C:\\Users\\Phi\\OneDrive - VietNam National University - HCM INTERNATIONAL UNIVERSITY\\Desktop\\Technical_Network_Site\\backend\\src\\utils\\knowledge.docx',
        'utf8'
      ); 
    } catch (err) {
      console.error("Error reading knowledge file:", err);
      return '';
    }
  }
  


/**
 * Starts a new conversation thread.
 * @returns {string} A new thread ID.
 */
export async function startConversation(id) {
    const threadId = id;
    // Load knowledge content to provide context for the assistant.
    const knowledgeContent = getKnowledgeContent();
  
    // Initialize the conversation context with a system message containing the knowledge content.
    conversations[threadId] = [
      { role: 'system', content: knowledgeContent }
    ];
    
    return threadId;
}



/**
 * Sends a message to the Ollama chat and returns the assistant's response.
 * The conversation context is maintained in memory.
 * @param {string} threadId - The conversation thread ID.
 * @param {string} userInput - The user's message.
 * @returns {string} The assistant's response.
 */
export async function chatResponse(threadId, userInput) {
    if (!conversations[threadId]) {
      throw new Error('Invalid thread ID');
    }
  
    // Append the user's message to the conversation history
    conversations[threadId].push({ role: 'user', content: userInput });
  
    // Call Ollama chat with the conversation history.
    const response = await ollama.chat({
      model: 'llama3.2',
      messages: conversations[threadId],
    });
  
    // Save the assistant's reply back into the conversation history
    conversations[threadId].push({ role: 'assistant', content: response.message.content });
  
    return response.message.content;
}


