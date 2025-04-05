import express from "express";
import { protectRoutes } from "../middleware/protectRoutes.js";
import { Chat, openConversation } from "../controllers/chatBotController.js";

const ChatBotRouter = express.Router();

ChatBotRouter.get("/start", protectRoutes, openConversation)
ChatBotRouter.post("/chat", protectRoutes, Chat)

export default ChatBotRouter;