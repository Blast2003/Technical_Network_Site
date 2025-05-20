// import {startConversation, chatResponse, analyzeQuestion, generateQueries, formatQueryResults, identifyTaxonomyKeywords, isSupportedQuery, categorizeTaxonomy, isSupportedTopics, chatResponseFromQueries} from "../utils/chatBotAction.js"

import {startConversation, chatResponse, isSupportedQuery, chatResponseFromQueries} from "../utils/chatBotAction.js"
import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

function isQueryLeakRequest(message) {
    const leakPatterns = [
      /\bquery\b/i,
      /\bsql\b/i,
      /reuse your queries/i,
      /give me the queries/i,
      /show me the queries/i
    ];
    return leakPatterns.some((pattern) => pattern.test(message));
  }

export const openConversation = async (req, res) =>{
    try {
        const userId = req.user.id;
        const threadId = await startConversation(userId);
        return res.status(200).json({ thread_id: threadId });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// export const Chat = async (req, res) => {
//   try {
//       const { thread_id, message } = req.body;
//       if (!thread_id || !message) {
//           return res.status(400).json({ error: 'Missing thread_id or message' });
//       }


//       // Block explicit requests for internal SQL queries
//     if (isQueryLeakRequest(message)) {
//         return res.status(403).json({ response: "I'm sorry, but I cannot share the internal database queries." });
//       }
  

//       const requiresDb = await analyzeQuestion(message);

//       console.log("aaaaaaaaaaaaaaaaaaaaaa", requiresDb)

//       if (!requiresDb) {
//           const responseMessage = await chatResponse(thread_id, message);
//           return res.status(200).json({ response: responseMessage });
//       }


//       // Check the pattern for using queries
//       if (!isSupportedQuery(message)) {
//         return res
//           .status(200)
//           .json({ response: "We don't provide that service!" });
//       }


//       // define taxonomy from user's input
//       const taxonomy = await categorizeTaxonomy(message);

//       if ([
//             'Core Infrastructure & Operations',
//               'Software & Application Development',
//               'Data & Intelligence',
//               'Security & Operations Management',
//              'Emerging Technologies'
//           ].includes(taxonomy) && isSupportedTopics(message)) {
//               // Check to keyword of user input
//             const identifyKeywords = identifyTaxonomyKeywords(message);

//             let keywordAnalysisString;
            
//             if (identifyKeywords.length === 0){
//               keywordAnalysisString = `The keyword of the user's prompt that i analyze and identify is: empty`;
//             }else{
//               keywordAnalysisString = `The keyword of the user's prompt that i analyze and identify is: ${identifyKeywords.join(', ')}`;
//             }


//             // Generate SQL queries
//             const sqlString = await generateQueries(thread_id, message, keywordAnalysisString, taxonomy);
//             const rawQueries = sqlString.split(';').map(q => q.trim()).filter(q => q.length > 0);
//             const executionResults = [];

//             // Execute queries
//             for (let query of rawQueries) {
//                 try {
//                     const result = await sequelize.query(query, { type: QueryTypes.SELECT });
//                     executionResults.push(result);
//                 } catch (execErr) {
//                     executionResults.push({ error: execErr.message });
//                 }
//             }

//             console.log("executionResults: ", executionResults)

//             // Format query results and update history
//             const formattedResponse = await formatQueryResults(thread_id, message, executionResults);

//             // Send formatted response to client
//             return res.status(200).json({ response: formattedResponse });
//           }

        

//       // Check to keyword of user input
//       const identifyKeywords = identifyTaxonomyKeywords(message);

//       let keywordAnalysisString;
      
//       if (identifyKeywords.length === 0){
//         keywordAnalysisString = `The keyword of the user's prompt that i analyze and identify is: empty`;
//       }else{
//         keywordAnalysisString = `The keyword of the user's prompt that i analyze and identify is: ${identifyKeywords.join(', ')}`;
//       }


//       // Generate SQL queries
//       const sqlString = await generateQueries(thread_id, message, keywordAnalysisString, '');
//       const rawQueries = sqlString.split(';').map(q => q.trim()).filter(q => q.length > 0);
//       const executionResults = [];

//       // Execute queries
//       for (let query of rawQueries) {
//           try {
//               const result = await sequelize.query(query, { type: QueryTypes.SELECT });
//               executionResults.push(result);
//           } catch (execErr) {
//               executionResults.push({ error: execErr.message });
//           }
//       }

//       console.log("executionResults: ", executionResults)

//       // Format query results and update history
//       const formattedResponse = await formatQueryResults(thread_id, message, executionResults);

//       // Send formatted response to client
//       return res.status(200).json({ response: formattedResponse });

//   } catch (error) {
//       console.error('Error in Chat controller:', error);
//       return res.status(500).json({ error: error.message });
//   }
// };


export const Chat = async (req, res) => {
  try {
      const { thread_id, message } = req.body;
      if (!thread_id || !message) {
          return res.status(400).json({ error: 'Missing thread_id or message' });
      }

      if(!isSupportedQuery(message)){
        const responseMessage = await chatResponse(thread_id, message);
        return res.status(200).json({ response: responseMessage });
      }

        const responseMessageFromQueriesResult = await chatResponseFromQueries(thread_id, message);
        return res.status(200).json({ response: responseMessageFromQueriesResult });

  } catch (error) {
      console.error('Error in Chat controller:', error);
      return res.status(500).json({ error: error.message });
  }
};