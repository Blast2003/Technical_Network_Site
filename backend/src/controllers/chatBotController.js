import {startConversation, chatResponse} from "../utils/chatBotAction.js"


export const openConversation = async (req, res) =>{
    try {
        const userId = req.user.id;
        const threadId = await startConversation(userId);
        return res.status(200).json({ thread_id: threadId });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}


export const Chat = async (req, res) =>{
    try {
        const { thread_id, message } = req.body;
        if (!thread_id || !message) {
          return res.status(400).json({ error: 'Missing thread_id or message' });
        }
        const responseMessage = await chatResponse(thread_id, message);
        return res.status(200).json({ response: responseMessage });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}