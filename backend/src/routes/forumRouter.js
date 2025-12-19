import express from "express";
import { protectRoutes } from "../middleware/protectRoutes.js";
import { isForumMember, isForumAdmin, isGlobalAdmin } from "../middleware/forumAuth.js";
import * as forumCtrl from "../controllers/forumController.js";

const forumRouter = express.Router();

// Public routes (with authentication)
forumRouter.get("/", protectRoutes, forumCtrl.listForums);

// Forum management - global admin only
forumRouter.post("/", protectRoutes, isGlobalAdmin, forumCtrl.createForum);
forumRouter.patch("/:forumId", protectRoutes, isGlobalAdmin, forumCtrl.updateForum);
forumRouter.delete("/:forumId", protectRoutes, isGlobalAdmin, forumCtrl.deleteForum);

// Forum access - members or global admin
forumRouter.get("/:forumId", protectRoutes, forumCtrl.getForum);
forumRouter.post("/:forumId/join", protectRoutes, forumCtrl.joinForum);
forumRouter.post("/:forumId/leave", protectRoutes, isForumMember, forumCtrl.leaveForum);

// Invites - members or global admin can invite
forumRouter.post("/:forumId/invite", protectRoutes, isForumMember, forumCtrl.createInvite);
forumRouter.post("/:forumId/invite/:inviteId/accept", protectRoutes, forumCtrl.acceptInvite);
forumRouter.post("/:forumId/invite/:inviteId/decline", protectRoutes, forumCtrl.declineInvite);

// NEW: list invites received by current user
forumRouter.get("/invites/received", protectRoutes, forumCtrl.listReceivedInvites);
// NEW: list invites for a specific forum (only forum members or global admins)
forumRouter.get("/:forumId/invites", protectRoutes, isForumMember, forumCtrl.listForumInvites);

// Threads - forum admin
forumRouter.get("/:forumId/threads", protectRoutes, forumCtrl.listThreads);
forumRouter.post("/:forumId/threads", protectRoutes, isForumAdmin, forumCtrl.createThread);
forumRouter.patch("/:forumId/threads/:threadId", protectRoutes, isForumAdmin, forumCtrl.updateThread);
forumRouter.delete("/:forumId/threads/:threadId", protectRoutes, isForumAdmin, forumCtrl.deleteThread);

// Questions & Answers - members 
forumRouter.get("/threads/:threadId/questions", protectRoutes, forumCtrl.listQuestions);
forumRouter.post("/threads/:threadId/questions", protectRoutes, forumCtrl.createQuestion);
forumRouter.post("/questions/:questionId/ai_summary", protectRoutes, forumCtrl.generateAnswerSummary);
forumRouter.get("/questions/:questionId", protectRoutes, forumCtrl.getQuestionDetail);
forumRouter.patch("/questions/:questionId", protectRoutes, forumCtrl.updateQuestion);
forumRouter.delete("/questions/:questionId", protectRoutes, forumCtrl.deleteQuestion);

forumRouter.get("/questions/:questionId/answers", protectRoutes, forumCtrl.listAnswers);
forumRouter.post("/questions/:questionId/answers", protectRoutes, forumCtrl.createAnswer);
forumRouter.patch("/answers/:answerId", protectRoutes, forumCtrl.updateAnswer);
forumRouter.delete("/answers/:answerId", protectRoutes, forumCtrl.deleteAnswer);

// Unseen endpoints
forumRouter.get("/users/:userId/questions", protectRoutes, forumCtrl.listUserQuestionsWithUnseen);
forumRouter.get("/questions/:questionId/unseen_count", protectRoutes, forumCtrl.getUnseenCount);
forumRouter.post("/questions/:questionId/mark_answers_seen", protectRoutes, forumCtrl.markAnswersSeen);



// List members (members + user info). Accessible to forum members OR global admin.
forumRouter.get("/:forumId/members", protectRoutes, forumCtrl.listForumMembers);

// Manage a member's role (global admin only)
forumRouter.patch("/:forumId/members/:userId/role", protectRoutes, isGlobalAdmin, forumCtrl.updateMemberRole);

// Remove a member from forum (global admin only)
forumRouter.delete("/:forumId/members/:userId", protectRoutes, isGlobalAdmin, forumCtrl.removeForumMember);


// ---------------- New endpoints for toxicity / bans --------------------
// List toxic users in a forum (forum_admin or global_admin)
forumRouter.get("/:forumId/toxic-users", protectRoutes, isForumAdmin, forumCtrl.listToxicUsers);

// List currently active bans for a forum (forum_admin)
forumRouter.get("/:forumId/bans", protectRoutes, isForumAdmin, forumCtrl.listBannedUsers);

// Ban / unban endpoints (forum_admin or global_admin)
forumRouter.post("/:forumId/ban/:userId", protectRoutes, isForumAdmin, forumCtrl.banForumMember);
forumRouter.post("/:forumId/ban/:userId/unban", protectRoutes, isForumAdmin, forumCtrl.unbanForumMember);

// Check user ban status (admin)
forumRouter.get("/:forumId/ban/:userId/status", protectRoutes, isForumAdmin, forumCtrl.checkUserBanStatus);

// List toxic answer of specific user
forumRouter.get("/:forumId/toxic-users/:userId/answers", protectRoutes, isForumAdmin, forumCtrl.listToxicAnswersForUser);

// allow current user to check their ban status for a forum
forumRouter.get("/:forumId/ban/me", protectRoutes, forumCtrl.checkMyBanStatus);


// NEW: history of bans for a specific user in a forum (forum_admin)
forumRouter.get("/:forumId/bans/:userId/history", protectRoutes, isForumAdmin, forumCtrl.listUserBanHistory);


export default forumRouter;