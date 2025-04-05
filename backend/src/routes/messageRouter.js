import express from "express";
import { protectRoutes } from "../middleware/protectRoutes.js";
import { sendMessage, getMessages, getConversations } from '../controllers/messageController.js';

const messageRouter = express.Router();

messageRouter.post("/", protectRoutes, sendMessage)
messageRouter.get("/:otherUserId", protectRoutes, getMessages)
messageRouter.get("/", protectRoutes, getConversations)

export default messageRouter;