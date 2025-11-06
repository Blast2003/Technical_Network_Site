// src/middleware/forumAuth.js
import { getUserForumRole } from "../services/forumPermissions.js";

/**
 * isForumMember - ensure user is a member of forum (or global_admin stored in forummembers)
 */
export const isForumMember = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const userId = req.user.id;
    const forumId = parseInt(req.params.forumId || req.body.forumId || req.query.forumId, 10);
    if (!forumId) return res.status(400).json({ error: "forumId missing" });

    const { isGlobal, role, membership } = await getUserForumRole(userId, forumId);
    if (isGlobal || role === "member" || role === "forum_admin" || role === "global_admin") {
      req.forumMember = membership || null;
      return next();
    }

    return res.status(403).json({ error: "Join forum to access" });
  } catch (err) {
    console.error("isForumMember middleware error", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * isForumAdmin - ensure user is forum_admin for that forum OR global admin flag
 */
export const isForumAdmin = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const userId = req.user.id;
    const forumId = parseInt(req.params.forumId || req.body.forumId || req.query.forumId, 10);
    if (!forumId) return res.status(400).json({ error: "forumId missing" });

    const { isGlobal, role, membership } = await getUserForumRole(userId, forumId);
    if (isGlobal || role === "forum_admin" || role === "global_admin") {
      req.forumMember = membership || null;
      return next();
    }
    return res.status(403).json({ error: "Forum admin required" });
  } catch (err) {
    console.error("isForumAdmin middleware error", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * isGlobalAdmin - checks user flag only (fast)
 */
export const isGlobalAdmin = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.is_global_admin) return next();
    return res.status(403).json({ error: "Global admin required" });
  } catch (err) {
    console.error("isGlobalAdmin middleware error", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
