import express from "express";
import { protectRoutes } from "../middleware/protectRoutes.js";
import { createPost, getPost, deletePost, likeUnlikePost, replyToPost, getFeedPosts, getUserPosts, getFilterPosts, getReplyPost, getTrendingTopics, getRecruitmentPosts, getPostNotifications, deleteReply } from '../controllers/postController.js';

const postRouter = express.Router();
postRouter.get("/:id", getPost)
postRouter.get("/user/:username", getUserPosts)
postRouter.get("/:id/replies", getReplyPost)
postRouter.get("/recruitment/post", protectRoutes, getRecruitmentPosts)
postRouter.get("/recipient/notification", protectRoutes, getPostNotifications)

postRouter.post("/create", protectRoutes, createPost)
postRouter.delete("/delete/:postId", protectRoutes, deletePost)

postRouter.put("/like/:id", protectRoutes, likeUnlikePost);
postRouter.put("/reply/:id", protectRoutes, replyToPost);
postRouter.delete("/reply/:id", protectRoutes, deleteReply);

postRouter.get("/feed/post", protectRoutes, getFeedPosts)
postRouter.get("/filter/:field", protectRoutes, getFilterPosts)
postRouter.get("/topic/trending", getTrendingTopics)

export default postRouter;