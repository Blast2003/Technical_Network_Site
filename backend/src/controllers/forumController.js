// src/controllers/forumController.js
import { Op, Sequelize } from "sequelize";
import { sequelize } from "../config/database.js";
import { v2 as cloudinary } from "cloudinary";
import { io, getRecipientSocketId } from "../socket/socket.js";

import { SummarizeAnswers } from "../gemini/useAI5.js";
import {
  Forum,
  ForumMember,
  Thread,
  Question,
  Answer,
  ForumInvite,
  ForumAudit,
  AnswerView,
  ForumBan,
} from "../models/forumModel.js";
import { User } from "../models/userModel.js";

import { getUserForumRole, canViewForumContents } from "../services/forumPermissions.js";
import { analyzeToxicityLevel } from "../services/aiToxicity.js";
import { createBan, getActiveBan, liftBan } from "../services/forumBanService.js";

/**
 * Helper: upload image (base64 or file url) to Cloudinary, return secure_url or null
 */
async function uploadIfPresent(img) {
  if (!img) return null;
  if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://"))) {
    return img;
  }
  const uploaded = await cloudinary.uploader.upload(img);
  return uploaded.secure_url;
}


function durationToMs(durationKey) {
  switch (durationKey) {
    case "1d": return 24 * 3600 * 1000;
    case "7d": return 7 * 24 * 3600 * 1000;
    case "1m": return 30 * 24 * 3600 * 1000;
    case "6m": return 6 * 30 * 24 * 3600 * 1000;
    case "forever": return null;
    default: return null;
  }
}

function recommendBanByCount(count) {
  // deterministic rule-based recommendation (no AI)
  // You can change thresholds as you want.
  if (count <= 1) return { duration: "1d", label: "1 day" };
  if (count <= 3) return { duration: "7d", label: "7 days" };
  if (count <= 6) return { duration: "1m", label: "1 month" };
  if (count <= 9) return { duration: "6m", label: "6 months" };
  return { duration: "forever", label: "forever" };
}



/**
 * listForums
 * GET /api/forum
 * Public (requires auth per router). For each forum, attach status: 'joined'|'invited'|'not_joined' and isAdmin flag.
 */
export const listForums = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const forums = await Forum.findAll({ where: { is_active: true }, order: [["createdAt", "DESC"]] });

    const payload = await Promise.all(
      forums.map(async (f) => {
        if (!userId) {
          // non-authenticated (though router requires protectRoutes normally) or no user
          return {
            id: f.id,
            field_key: f.field_key,
            title: f.title,
            description: f.description ? (f.description.length > 200 ? f.description.slice(0, 197) + "..." : f.description) : null,
            member_count: f.member_count,
            status: "not_joined",
            isAdmin: false,
          };
        }

        const membership = await ForumMember.findOne({ where: { forum_id: f.id, user_id: userId } });
        const invite = await ForumInvite.findOne({ where: { forum_id: f.id, receiver_id: userId, status: "pending" } });
        const isGlobalFlag = req.user?.is_global_admin || false;
        const isAdmin = isGlobalFlag || (membership && (membership.role === "forum_admin" || membership.role === "global_admin"));

        const status = membership ? "joined" : invite ? "invited" : "not_joined";

        return {
          ...f.toJSON(),
          status,
          isAdmin: !!isAdmin,
        };
      })
    );

    return res.json(payload);
  } catch (err) {
    console.error("listForums error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * getForum
 * GET /api/forum/:forumId
 *
 * Behavior:
 * - If user is global_admin or forum_admin/member -> return full forum + sample threads.
 * - If user is non-member -> return limited forum metadata (title, short description, member_count) WITHOUT threads/content.
 */
export const getForum = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    if (!forumId) return res.status(400).json({ error: "forumId required" });

    const forum = await Forum.findByPk(forumId);
    if (!forum) return res.status(404).json({ error: "Forum not found" });

    const userId = req.user?.id || null;

    // membership & invite checks (so we can return status/isAdmin even for limited views)
    const membership = userId ? await ForumMember.findOne({ where: { forum_id: forumId, user_id: userId } }) : null;
    const invite = userId ? await ForumInvite.findOne({ where: { forum_id: forumId, receiver_id: userId, status: "pending" } }) : null;

    const isGlobalFlag = !!(req.user && req.user.is_global_admin);
    const isAdmin = isGlobalFlag || (membership && (membership.role === "forum_admin" || membership.role === "global_admin"));
    const status = membership ? "joined" : invite ? "invited" : "not_joined";

    // can the user view forum contents (threads)? use existing helper
    const canView = userId ? await canViewForumContents(userId, forumId) : false;

    const base = {
      id: forum.id,
      field_key: forum.field_key,
      title: forum.title,
      description: forum.description ? (forum.description.length > 300 ? forum.description.slice(0, 297) + "..." : forum.description) : null,
      member_count: forum.member_count,
      visibility: forum.visibility,
      status,
      isAdmin: !!isAdmin,
      is_active: forum.is_active,
      createdAt: forum.createdAt,
      updatedAt: forum.updatedAt,
    };

    if (!canView) {
      // Non-member: return limited metadata but include status/isAdmin so frontend knows what actions to show
      return res.json(base);
    }

    // Member/admin/global -> include threads summary (with creator alias)
    const threads = await Thread.findAll({
      where: { forum_id: forumId },
      include: [{ model: User, as: "creator", attributes: ["id", "username", "profilePic"] }],
      attributes: ["id", "title", "image_url", "createdAt", "creator_id", "content"],
      limit: 50,
      order: [["createdAt", "DESC"]],
    });

    const threadsNormalized = threads.map(t => {
      const tj = t.toJSON();
      return {
        id: tj.id,
        title: tj.title,
        content: tj.content,
        image_url: tj.image_url,
        createdAt: tj.createdAt,
        creator_id: tj.creator_id,
        creatorName: tj.creator?.username || null,
        creatorProfilePic: tj.creator?.profilePic || null,
      };
    });

    return res.json({ ...base, threads: threadsNormalized });
  } catch (err) {
    console.error("getForum error", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

/**
 * createForum
 * unchanged semantics; router enforces global admin
 */
export const createForum = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { field_key, title, description, visibility = "public", create_template_threads = false } = req.body;
    const creatorId = req.user.id;

    if (!field_key || !title) {
      await t.rollback();
      return res.status(400).json({ error: "field_key and title are required" });
    }

    const existing = await Forum.findOne({ where: { field_key }, transaction: t });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ error: "Forum with same field_key exists" });
    }

    const forum = await Forum.create(
      { field_key, title, description: description || null, visibility, created_by: creatorId },
      { transaction: t }
    );

    // creator becomes forum_admin (and member)
    await ForumMember.create({ forum_id: forum.id, user_id: creatorId, role: "global_admin" }, { transaction: t });

    // Make sure member_count reflects the creator (so API response and socket payload show 1)
    await forum.update({ member_count: (forum.member_count || 0) + 1 }, { transaction: t });

    if (create_template_threads) {
      const templates = ["Announcements", "Career Path Questions", "Troubleshooting / Debug Help", "Resources & Tutorials", "Trends & News"];
      await Promise.all(templates.map((tname) => Thread.create({ forum_id: forum.id, creator_id: creatorId, title: tname }, { transaction: t })));
      await forum.update({ template_threads_created: true }, { transaction: t });
    }

    await ForumAudit.create({ actor_id: creatorId, forum_id: forum.id, action: "create_forum", meta: { title } }, { transaction: t });

    // reload to ensure the updated fields are available (member_count etc.)
    await forum.reload({ transaction: t });

    await t.commit();

    // Emit the forum_created event with the forum object (now includes updated member_count)
    io.emit("forum_created", forum);

    return res.status(201).json(forum);
  } catch (err) {
    await t.rollback();
    console.error("createForum error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * updateForum
 * PATCH /api/forum/:forumId
 * only global admin (router enforces). Keep as-is.
 */
export const updateForum = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const forum = await Forum.findByPk(forumId, { transaction: t });
    if (!forum) { await t.rollback(); return res.status(404).json({ error: "Forum not found" }); }

    const { title, description, visibility, is_active } = req.body;
    await forum.update({ title: title ?? forum.title, description: description ?? forum.description, visibility: visibility ?? forum.visibility, is_active: typeof is_active === "boolean" ? is_active : forum.is_active }, { transaction: t });

    await ForumAudit.create({ actor_id: req.user.id, forum_id: forumId, action: "update_forum", meta: { updates: req.body } }, { transaction: t });

    await t.commit();
    io.emit("forum_updated", forum);
    return res.json(forum);
  } catch (err) {
    await t.rollback();
    console.error("updateForum error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * deleteForum
 * DELETE /api/forum/:forumId
 * only global admin
 */
export const deleteForum = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const forumId = parseInt(req.params.forumId, 10);

    
    // 1. Find the Forum
    const forum = await Forum.findByPk(forumId, { transaction: t });
    
    if (!forum) { 
      await t.rollback(); 
      return res.status(404).json({ error: "Forum not found" }); 
    }

    // 2. Perform HARD DELETE
    // Since the Forum model is paranoid, we must use { force: true } 
    // to permanently delete the record.
    await forum.destroy({ force: true, transaction: t });

    // 3. Create Audit Log
    await ForumAudit.create(
      { actor_id: req.user.id, forum_id: forumId, action: "hard_delete_forum" },
      { transaction: t }
    );

    await t.commit();
    io.emit("forum_deleted", { forumId });
    return res.json({ success: true, message: `Forum ${forumId} permanently deleted.` });
  } catch (err) {
    await t.rollback();
    console.error("deleteForum (hard delete) error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * joinForum
 */
export const joinForum = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = req.user.id;

    const forum = await Forum.findByPk(forumId, { transaction: t });
    if (!forum) { await t.rollback(); return res.status(404).json({ error: "Forum not found" }); }
    if (!forum.is_active) { await t.rollback(); return res.status(400).json({ error: "Forum inactive" }); }

    const existing = await ForumMember.findOne({ where: { forum_id: forumId, user_id: userId }, transaction: t });
    if (existing) { await t.rollback(); return res.status(200).json({ message: "Already joined" }); }

    // If forum private, require invite
    if (forum.visibility === "private") {
      const invite = await ForumInvite.findOne({ where: { forum_id: forumId, receiver_id: userId, status: "pending" }, transaction: t });
      if (!invite) { await t.rollback(); return res.status(403).json({ error: "Private forum, invitation required" }); }
      await invite.update({ status: "accepted" }, { transaction: t });
    }

    await ForumMember.create({ forum_id: forumId, user_id: userId, role: "member" }, { transaction: t });
    await forum.increment("member_count", { by: 1, transaction: t });
    await ForumAudit.create({ actor_id: userId, forum_id: forumId, action: "join_forum" }, { transaction: t });

    await t.commit();
    io.to(`forum_${forumId}`).emit("member_joined", { forumId, userId });
    return res.json({ success: true });
  } catch (err) {
    await t.rollback();
    console.error("joinForum error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * leaveForum
 */
export const leaveForum = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = req.user.id;

    const membership = await ForumMember.findOne({ where: { forum_id: forumId, user_id: userId }, transaction: t });
    if (!membership) { await t.rollback(); return res.status(400).json({ error: "Not a member" }); }

    await membership.destroy({ transaction: t });
    const forum = await Forum.findByPk(forumId, { transaction: t });
    if (forum && forum.member_count > 0) await forum.decrement("member_count", { by: 1, transaction: t });

    await ForumAudit.create({ actor_id: userId, forum_id: forumId, action: "leave_forum" }, { transaction: t });
    await t.commit();

    io.to(`forum_${forumId}`).emit("member_left", { forumId, userId });
    return res.json({ success: true });
  } catch (err) {
    await t.rollback();
    console.error("leaveForum error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * createInvite
 * any forum member or global admin can invite
 */
export const createInvite = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const senderId = req.user.id;
    const { receiver_id, message } = req.body;
    if (!receiver_id) { await t.rollback(); return res.status(400).json({ error: "receiver_id required" }); }

    const forum = await Forum.findByPk(forumId, { transaction: t });
    if (!forum) { await t.rollback(); return res.status(404).json({ error: "Forum not found" }); }

    const membership = await ForumMember.findOne({ where: { forum_id: forumId, user_id: senderId }, transaction: t });
    const { isGlobal } = await getUserForumRole(senderId, forumId);

    if (!membership && !isGlobal) { await t.rollback(); return res.status(403).json({ error: "Join forum to invite" }); }

    const existingInvite = await ForumInvite.findOne({ where: { forum_id: forumId, receiver_id, status: "pending" }, transaction: t });
    if (existingInvite) { await t.rollback(); return res.status(200).json({ message: "Already invited" }); }

    const invite = await ForumInvite.create({ forum_id: forumId, sender_id: senderId, receiver_id, message: message || null }, { transaction: t });
    await ForumAudit.create({ actor_id: senderId, forum_id: forumId, action: "create_invite", meta: { inviteId: invite.id } }, { transaction: t });

    await t.commit();
    // emit to receiver personal socket
    const recipientSocketId = getRecipientSocketId(String(receiver_id));
    if (recipientSocketId) io.to(recipientSocketId).emit("forum_invite", invite);

    return res.status(201).json(invite);
  } catch (err) {
    await t.rollback();
    console.error("createInvite error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * acceptInvite
 */
export const acceptInvite = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const inviteId = parseInt(req.params.inviteId, 10);
    const userId = req.user.id;
    const invite = await ForumInvite.findByPk(inviteId, { transaction: t });
    if (!invite) { await t.rollback(); return res.status(404).json({ error: "Invite not found" }); }
    if (invite.receiver_id !== userId) { await t.rollback(); return res.status(403).json({ error: "Not invite receiver" }); }
    if (invite.status !== "pending") { await t.rollback(); return res.status(400).json({ error: "Invite not pending" }); }

    await invite.update({ status: "accepted" }, { transaction: t });
    await ForumMember.create({ forum_id: invite.forum_id, user_id: userId, role: "member" }, { transaction: t });

    // increment forum member_count safely
    const forum = await Forum.findByPk(invite.forum_id, { transaction: t });
    if (forum) await forum.increment("member_count", { by: 1, transaction: t });

    await ForumAudit.create({ actor_id: userId, forum_id: invite.forum_id, action: "accept_invite", meta: { inviteId } }, { transaction: t });

    await t.commit();
    io.to(`forum_${invite.forum_id}`).emit("member_joined", { forumId: invite.forum_id, userId });
    return res.json({ success: true });
  } catch (err) {
    await t.rollback();
    console.error("acceptInvite error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * declineInvite
 */
export const declineInvite = async (req, res) => {
  try {
    const inviteId = parseInt(req.params.inviteId, 10);
    const userId = req.user.id;
    const invite = await ForumInvite.findByPk(inviteId);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.receiver_id !== userId) return res.status(403).json({ error: "Not invite receiver" });

    await invite.destroy();
    await ForumAudit.create({ actor_id: userId, forum_id: invite.forum_id, action: "decline_invite", meta: { inviteId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("declineInvite error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * listReceivedInvites
 * GET /api/forum/invites/received
 * Returns pending invites where current user is the receiver.
 */
export const listReceivedInvites = async (req, res) => {
  try {
    const userId = req.user.id;

    // find pending invites for this receiver (descending newest first)
    const invites = await ForumInvite.findAll({
      where: { receiver_id: userId, status: "pending" },
      order: [["createdAt", "DESC"]],
    });

    // attach sender and forum info for each invite
    const enriched = await Promise.all(invites.map(async (inv) => {
      const plain = inv.get ? inv.get({ plain: true }) : { ...inv };
      try {
        const [sender, forum] = await Promise.all([
          User.findByPk(inv.sender_id, { attributes: ["id", "name", "username", "profilePic", "position"] }),
          Forum.findByPk(inv.forum_id, { attributes: ["id", "title", "field_key", "description"] }),
        ]);
        return {
          ...plain,
          sender: sender ? sender.get({ plain: true }) : null,
          forum: forum ? forum.get({ plain: true }) : null,
        };
      } catch (innerErr) {
        // fallback: return invite as-is if enrichment fails
        console.warn("invite enrichment failed", innerErr);
        return plain;
      }
    }));

    return res.json(enriched);
  } catch (err) {
    console.error("listReceivedInvites error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * listForumInvites
 * GET /api/forum/:forumId/invites
 * Returns invites associated with the given forum.
 * Access control: only members or global admins (handled by isForumMember middleware, but we also double-check).
 */
export const listForumInvites = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    if (Number.isNaN(forumId)) return res.status(400).json({ error: "Invalid forumId" });

    const forum = await Forum.findByPk(forumId);
    if (!forum) return res.status(404).json({ error: "Forum not found" });

    // double-check permissions (safe-guard)
    // getUserForumRole should return { isGlobal, role } similar to other controller usage
    if (typeof getUserForumRole === "function") {
      const { isGlobal, role } = await getUserForumRole(req.user.id, forumId);
      const isMember = isGlobal || !!role;
      if (!isMember) return res.status(403).json({ error: "Not allowed to view invites for this forum" });
    }

    const invites = await ForumInvite.findAll({
      where: { forum_id: forumId },
      order: [["createdAt", "DESC"]],
    });

    const enriched = await Promise.all(invites.map(async (inv) => {
      const plain = inv.get ? inv.get({ plain: true }) : { ...inv };
      try {
        const [sender, receiver] = await Promise.all([
          User.findByPk(inv.sender_id, { attributes: ["id", "name", "username", "profilePic", "position"] }),
          User.findByPk(inv.receiver_id, { attributes: ["id", "name", "username", "profilePic", "position"] }),
        ]);
        return {
          ...plain,
          sender: sender ? sender.get({ plain: true }) : null,
          receiver: receiver ? receiver.get({ plain: true }) : null,
        };
      } catch (innerErr) {
        console.warn("forum invite enrichment failed", innerErr);
        return plain;
      }
    }));

    return res.json(enriched);
  } catch (err) {
    console.error("listForumInvites error", err);
    return res.status(500).json({ error: err.message });
  }
};



/**
 * listThreads
 * GET /api/forum/:forumId/threads
 *
 * Only visible to forum members, forum_admin for that forum, or global admins.
 */
export const listThreads = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    if (!forumId) return res.status(400).json({ error: "forumId required" });

    const userId = req.user?.id;
    // check permission
    const canView = await canViewForumContents(userId, forumId);
    if (!canView) return res.status(403).json({ error: "Join forum to view threads" });

    // Use alias 'creator' (matches Thread.belongsTo(User, { as: 'creator' }))
    const threads = await Thread.findAll({
      where: { forum_id: forumId },
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "profilePic"] }
      ],
      order: [["createdAt", "DESC"]],
    });

    // Normalize payload for frontend convenience
    const out = threads.map(t => {
      const tj = t.toJSON();
      return {
        id: tj.id,
        title: tj.title,
        content: tj.content,
        image_url: tj.image_url,
        createdAt: tj.createdAt,
        creator_id: tj.creator_id,
        // support multiple possible shapes in frontend:
        creatorName: tj.creator?.username || tj.creatorName || null,
        creatorProfilePic: tj.creator?.profilePic || tj.creatorProfilePic || null,
        // include raw creator object in case frontend wants it
        creator: tj.creator || null,
      };
    });

    return res.json(out);
  } catch (err) {
    // more actionable log for easier debugging
    console.error("listThreads error (forumId:", req.params.forumId, "user:", req.user?.id, "):", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

/**
 * createThread
 * router enforces isForumAdmin; we still fetch forum and create
 */
export const createThread = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const { title, content, image } = req.body;
    const creatorId = req.user.id;

    if (!title) { await t.rollback(); return res.status(400).json({ error: "Title required" }); }
    const forum = await Forum.findByPk(forumId, { transaction: t });
    if (!forum) { await t.rollback(); return res.status(404).json({ error: "Forum not found" }); }

    const image_url = await uploadIfPresent(image);
    const thread = await Thread.create({ forum_id: forumId, creator_id: creatorId, title, content: content || null, image_url: image_url || null }, { transaction: t });

    await ForumAudit.create({ actor_id: creatorId, forum_id: forumId, action: "create_thread", meta: { threadId: thread.id } }, { transaction: t });
    await t.commit();

    io.to(`forum_${forumId}`).emit("new_thread", { thread });
    return res.status(201).json(thread);
  } catch (err) {
    await t.rollback();
    console.error("createThread error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * updateThread
 * PATCH /api/forum/threads/:threadId
 * allowed for forum_admin or global_admin (router enforces isForumAdmin). We also double-check.
 */
export const updateThread = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const threadId = parseInt(req.params.threadId, 10);
    const { title, content, image } = req.body;
    const thread = await Thread.findByPk(threadId, { transaction: t });
    if (!thread) { await t.rollback(); return res.status(404).json({ error: "Thread not found" }); }

    const { isGlobal, role } = await getUserForumRole(req.user.id, thread.forum_id);
    const isAdmin = isGlobal || role === "forum_admin" || role === "global_admin";
    if (!isAdmin) { await t.rollback(); return res.status(403).json({ error: "Not allowed to update thread" }); }

    let image_url = thread.image_url;
    if (image) image_url = await uploadIfPresent(image);

    await thread.update({ title: title ?? thread.title, content: content ?? thread.content, image_url }, { transaction: t });
    await ForumAudit.create({ actor_id: req.user.id, forum_id: thread.forum_id, action: "update_thread", meta: { threadId } }, { transaction: t });
    await t.commit();

    io.to(`forum_${thread.forum_id}`).emit("thread_updated", { thread });
    return res.json(thread);
  } catch (err) {
    await t.rollback();
    console.error("updateThread error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * deleteThread
 * router enforces isForumAdmin; double-check it here
 */
export const deleteThread = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const threadId = parseInt(req.params.threadId, 10);
    const thread = await Thread.findByPk(threadId, { transaction: t });
    if (!thread) { await t.rollback(); return res.status(404).json({ error: "Thread not found" }); }

    const { isGlobal, role } = await getUserForumRole(req.user.id, thread.forum_id);
    const isAdmin = isGlobal || role === "forum_admin" || role === "global_admin";
    if (!isAdmin) { await t.rollback(); return res.status(403).json({ error: "Not allowed to delete thread" }); }

    // Optionally delete thread image from cloudinary
    if (thread.image_url) {
      try {
        const parts = thread.image_url.split("/");
        const file = parts[parts.length - 1];
        const publicId = file.split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.warn("cloudinary destroy failed", e.message);
      }
    }

    await thread.destroy({ transaction: t });
    await ForumAudit.create({ actor_id: req.user.id, forum_id: thread.forum_id, action: "delete_thread", meta: { threadId } }, { transaction: t });
    await t.commit();

    io.to(`forum_${thread.forum_id}`).emit("thread_deleted", { threadId });
    return res.json({ success: true });
  } catch (err) {
    await t.rollback();
    console.error("deleteThread error", err);
    return res.status(500).json({ error: err.message });
  }
};

// listQuestions
export const listQuestions = async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId, 10);
    const userId = req.user.id;
    const limit = parseInt(req.query.limit || "10", 10);
    const offset = parseInt(req.query.offset || "0", 10);

    const thread = await Thread.findByPk(threadId);
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const canView = await canViewForumContents(userId, thread.forum_id);
    if (!canView) return res.status(403).json({ error: "Join forum to view questions" });

    const { count, rows } = await Question.findAndCountAll({
      where: { thread_id: threadId },
      include: [{ model: User, as: "creator", attributes: ["id", "username", "profilePic"] }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const questionIds = rows.map((q) => q.id);
    if (questionIds.length === 0) {
      return res.json({ total: count, questions: [] });
    }

    // Only count answers that are visible to the requesting user:
    // visible := (is_toxic = false) OR (sender_id = currentUser)
    const visibleAnswerWhere = {
      question_id: { [Op.in]: questionIds },
      [Op.or]: [
        { is_toxic: false },
        { sender_id: userId }
      ]
    };

    // --- batch answer counts per question (total answers) ---
    const answerCounts = await Answer.findAll({
      where: visibleAnswerWhere,
      attributes: ["question_id", [Sequelize.fn("COUNT", Sequelize.col("id")), "answerCount"]],
      group: ["question_id"],
      raw: true,
    });
    const answerCountMap = {};
    answerCounts.forEach((r) => { answerCountMap[r.question_id] = parseInt(r.answerCount, 10); });

    // --- NEW: compute new answer counts within the last 24 hours (explicit 24h cutoff) ---
    const last24Cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newAnswerCounts = await Answer.findAll({
      where: {
        question_id: { [Op.in]: questionIds },
        createdAt: { [Op.gte]: last24Cutoff },
        [Op.or]: [
          { is_toxic: false },
          { sender_id: userId }
        ]
      },
      attributes: ["question_id", [Sequelize.fn("COUNT", Sequelize.col("id")), "newCount"]],
      group: ["question_id"],
      raw: true,
    });
    const newAnswerCountMap = {};
    newAnswerCounts.forEach((r) => { newAnswerCountMap[r.question_id] = parseInt(r.newCount, 10); });

    // --- batch view counts by this user per question (join AnswerView -> Answer)
    // Note: consider using COUNT(DISTINCT AnswerView.answer_id) if duplicates are possible.
    const viewCounts = await AnswerView.findAll({
      where: { user_id: userId },
      include: [{ model: Answer, attributes: ["question_id"], required: true }],
      attributes: [[Sequelize.fn("COUNT", Sequelize.col("AnswerView.id")), "viewCount"], [Sequelize.col("Answer.question_id"), "question_id"]],
      group: ["Answer.question_id"],
      raw: true,
    });
    const viewCountMap = {};
    viewCounts.forEach((r) => { viewCountMap[r.question_id] = parseInt(r.viewCount || 0, 10); });

    const questions = rows.map((q) => {
      const qj = q.toJSON();
      const totalAnswers = answerCountMap[qj.id] || 0;
      const viewed = viewCountMap[qj.id] || 0;

      // NEW: new answers within last 24h — used as left-list badge
      const newSince24h = newAnswerCountMap[qj.id] || 0;

      return {
        ...qj,
        isMine: qj.creator_id === userId,
        unseenCount: newSince24h,
        totalAnswers,
        viewedByYou: viewed,
        creatorName: qj.creator?.username || null,
        creatorProfilePic: qj.creator?.profilePic || null,
      };
    });

    return res.json({ total: count, questions });
  } catch (err) {
    console.error("listQuestions error", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

/**
 * createQuestion
 */
export const createQuestion = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const threadId = parseInt(req.params.threadId, 10);
    const { title, content, image } = req.body;
    const userId = req.user.id;

    if (!title) { await t.rollback(); return res.status(400).json({ error: "title required" }); }

    const thread = await Thread.findByPk(threadId, { transaction: t });
    if (!thread) { await t.rollback(); return res.status(404).json({ error: "Thread not found" }); }

    const { isGlobal, role } = await getUserForumRole(userId, thread.forum_id);

    if (!(isGlobal || role === "member" || role === "forum_admin" || role === "global_admin")) { await t.rollback(); return res.status(403).json({ error: "Join forum to create question" }); }

    const image_url = await uploadIfPresent(image);
    const question = await Question.create({ thread_id: threadId, creator_id: userId, title, content: content || null, image_url: image_url || null }, { transaction: t });

    await ForumAudit.create({ actor_id: userId, forum_id: thread.forum_id, action: "create_question", meta: { questionId: question.id } }, { transaction: t });
    await t.commit();

    io.to(`thread_${threadId}`).emit("new_question", { question });
    return res.status(201).json(question);
  } catch (err) {
    await t.rollback();
    console.error("createQuestion error", err);
    return res.status(500).json({ error: err.message });
  }
};

// --- NEW controller: generateAnswerSummary (updated to avoid exposing IDs) ---
export const generateAnswerSummary = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const userId = req.user.id;

    const question = await Question.findByPk(questionId, { transaction: t });
    if (!question) { await t.rollback(); return res.status(404).json({ error: "Question not found" }); }

    const thread = await Thread.findByPk(question.thread_id, { transaction: t });
    const canView = await canViewForumContents(userId, thread.forum_id);
    if (!canView) { await t.rollback(); return res.status(403).json({ error: "Join forum to view question" }); }

    // fetch up to 10 answers created in the last 24 hours (most recent first)
    const last24Cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAnswers = await Answer.findAll({
      where: { question_id: questionId, 
        createdAt: { [Op.gte]: last24Cutoff }, 
        // exclude toxic answers from summarization
        is_toxic: false,
      },
      include: [{ model: User, as: "sender", attributes: ["id", "username", "profilePic"] }],
      order: [["createdAt", "DESC"]],
      limit: 10,
      transaction: t,
    });

    if (!recentAnswers || recentAnswers.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: "No recent answers in the last 24 hours to summarize." });
    }

    // --- collect sender ids and parent ids (if any) ---
    const senderIds = [...new Set(recentAnswers.map(a => a.sender_id))];
    const parentIds = [...new Set(recentAnswers.filter(a => a.parent_answer_id).map(a => a.parent_answer_id))];

    // fetch forum roles for senders in a single batched query
    const forumMembers = senderIds.length > 0
      ? await ForumMember.findAll({ where: { forum_id: thread.forum_id, user_id: senderIds }, transaction: t })
      : [];
    const roleMap = {};
    forumMembers.forEach((fm) => { roleMap[fm.user_id] = fm.role; });

    // fetch parent answers' senders so we can say "reply to an answer by <username>"
    let parentMap = {};
    if (parentIds.length > 0) {
      const parents = await Answer.findAll({
        where: { id: { [Op.in]: parentIds } },
        include: [{ model: User, as: "sender", attributes: ["id", "username"] }],
        transaction: t,
      });
      parents.forEach((p) => {
        const pj = p.toJSON();
        parentMap[pj.id] = { senderName: pj.sender?.username || null };
      });
    }

    // prepare compact payload for the AI (KEEP IT SAFE: NO NUMERIC ANSWER IDS IN THE PROMPT)
    const answersForAI = recentAnswers.map((a) => {
      const aj = a.toJSON();
      return {
        // no answer id here — do NOT include numeric ids in the prompt
        content: aj.content || "",
        senderName: (aj.sender && aj.sender.username) || `user_${aj.sender_id || "?"}`,
        senderRole: roleMap[aj.sender_id] || null,              // 'member' | 'forum_admin' | 'global_admin' | null
        parentType: aj.parent_answer_id ? "reply" : "direct",
        parentSenderName: aj.parent_answer_id ? (parentMap[aj.parent_answer_id]?.senderName || null) : null,
        createdAt: aj.createdAt,
      };
    });

    // compute usage-ish info (simple, cheap)
    const totalChars = answersForAI.reduce((s, a) => s + (a.content || "").length, 0);

    // call AI summarizer (server-side)
    let summaryText;
    try {
      summaryText = await SummarizeAnswers({
        thread: { id: thread.id, title: thread.title },
        question: { id: question.id, title: question.title, content: question.content },
        answers: answersForAI,
        timeoutMs: 10000, // 10s timeout
      });
    } catch (aiErr) {
      console.error("AI summarization failed:", aiErr);
      await t.rollback();
      return res.status(502).json({ error: "AI summarization failed", details: aiErr.message || String(aiErr) });
    }

    await t.commit();
    return res.json({
      summary: summaryText,
      usage: { answersCount: answersForAI.length, totalChars },
    });
  } catch (err) {
    await t.rollback();
    console.error("generateAnswerSummary error", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

// getQuestionDetail
export const getQuestionDetail = async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const question = await Question.findByPk(questionId, { include: [{ model: User, as: "creator", attributes: ["id", "username", "profilePic"] }] });
    if (!question) return res.status(404).json({ error: "Question not found" });

    const thread = await Thread.findByPk(question.thread_id);
    const canView = await canViewForumContents(req.user.id, thread.forum_id);
    if (!canView) return res.status(403).json({ error: "Join forum to view question" });

    const qj = question.toJSON();
    qj.creatorName = qj.creator?.username || null;
    qj.creatorProfilePic = qj.creator?.profilePic || null;
    return res.json(qj);
  } catch (err) {
    console.error("getQuestionDetail error", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};


/**
 * updateQuestion
 */
export const updateQuestion = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const { title, content, image } = req.body;
    const question = await Question.findByPk(questionId, { transaction: t });
    if (!question) { await t.rollback(); return res.status(404).json({ error: "Question not found" }); }

    const isOwner = question.creator_id === req.user.id;
    const thread = await Thread.findByPk(question.thread_id, { transaction: t });
    const { isGlobal, role } = await getUserForumRole(req.user.id, thread.forum_id);
    const isAdmin = isGlobal || role === "forum_admin" || role === "global_admin";
    if (!isOwner && !isAdmin) { await t.rollback(); return res.status(403).json({ error: "Not allowed to update" }); }

    let image_url = question.image_url;
    if (image) image_url = await uploadIfPresent(image);

    await question.update({ title: title ?? question.title, content: content ?? question.content, image_url }, { transaction: t });
    await ForumAudit.create({ actor_id: req.user.id, forum_id: thread.forum_id, action: "update_question", meta: { questionId } }, { transaction: t });

    await t.commit();
    io.to(`thread_${question.thread_id}`).emit("question_updated", { question });
    return res.json(question);
  } catch (err) {
    await t.rollback();
    console.error("updateQuestion error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * deleteQuestion
 */
export const deleteQuestion = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const question = await Question.findByPk(questionId, { transaction: t });
    if (!question) { await t.rollback(); return res.status(404).json({ error: "Question not found" }); }

    const thread = await Thread.findByPk(question.thread_id, { transaction: t });
    const isOwner = question.creator_id === req.user.id;
    const { isGlobal, role } = await getUserForumRole(req.user.id, thread.forum_id);
    const isAdmin = isGlobal || role === "forum_admin" || role === "global_admin";
    if (!isOwner && !isAdmin) { await t.rollback(); return res.status(403).json({ error: "Not allowed to delete" }); }

    // optionally destroy image
    if (question.image_url) {
      try {
        const parts = question.image_url.split("/");
        const file = parts[parts.length - 1];
        const publicId = file.split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (e) { /* ignore */ }
    }

    await question.destroy({ transaction: t });
    await ForumAudit.create({ actor_id: req.user.id, forum_id: thread.forum_id, action: "delete_question", meta: { questionId } }, { transaction: t });

    await t.commit();
    io.to(`thread_${question.thread_id}`).emit("question_deleted", { questionId });
    return res.json({ success: true });
  } catch (err) {
    await t.rollback();
    console.error("deleteQuestion error", err);
    return res.status(500).json({ error: err.message });
  }
};


// ----------------- listAnswers -----------------
export const listAnswers = async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const userId = req.user.id;
    const question = await Question.findByPk(questionId);
    if (!question) return res.status(404).json({ error: "Question not found" });

    const thread = await Thread.findByPk(question.thread_id);
    const forumId = thread.forum_id;
    const canView = await canViewForumContents(userId, forumId);
    if (!canView) return res.status(403).json({ error: "Join forum to view answers" });

    // Fetch all answers for the question (we'll filter banned ones below)
    const answersRaw = await Answer.findAll({
      where: { question_id: questionId },
      include: [{ model: User, as: "sender", attributes: ["id", "username", "profilePic"] }],
      order: [["createdAt", "ASC"]],
    });

    // Filter: remove banned (is_toxic) answers for anyone except the sender themselves.
    // This means only the creator (sender) will see their own banned answers.
    const answersVisible = answersRaw.filter(a => {
      // keep answer if not toxic OR if the current user is the sender
      return !a.is_toxic || Number(a.sender_id) === Number(userId);
    });

    // compute reply counts (based on visible answers only)
    const replyCountMap = {};
    answersVisible.forEach((a) => {
      const parentId = a.parent_answer_id;
      if (parentId) replyCountMap[parentId] = (replyCountMap[parentId] || 0) + 1;
    });

    // fetch forum member roles for the senders (for visible senders)
    const senderIds = [...new Set(answersVisible.map((a) => a.sender_id))];
    const forumRoles = senderIds.length > 0 ? await ForumMember.findAll({ where: { forum_id: forumId, user_id: senderIds } }) : [];
    const roleMap = {};
    forumRoles.forEach((r) => (roleMap[r.user_id] = r.role));

    // scoring heuristic (skip boosting banned answers for others because banned ones already filtered out)
    const scored = answersVisible.map((a) => {
      const reply_count = replyCountMap[a.id] || 0;
      const role = roleMap[a.sender_id] || null;
      const isAdmin = role === "forum_admin" || role === "global_admin";
      const lenScore = Math.min(5, Math.floor((a.content || "").length / 150));
      const recencyDays = (Date.now() - new Date(a.createdAt)) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - Math.min(recencyDays, 30) / 30);
      const score = reply_count * 4 + (isAdmin ? 15 : 0) + lenScore + recencyScore;
      return { a, score };
    });
    scored.sort((x, y) => y.score - x.score);

    const K = 3;
    const highlightedAnswers = scored.slice(0, K).map((s) => s.a);
    const highlightedIds = new Set(highlightedAnswers.map((a) => a.id));

    // build nested structure and attach senderRole
    const all = answersVisible.map((a) => {
      const obj = a.toJSON();
      obj.children = [];
      obj.senderName = (obj.sender && obj.sender.username) || null;
      obj.senderProfilePic = (obj.sender && obj.sender.profilePic) || null;
      obj.senderRole = roleMap[obj.sender_id] || null; // attached role
      return obj;
    });
    const byId = {};
    all.forEach((a) => { byId[a.id] = a; });
    const roots = [];
    all.forEach((a) => {
      if (a.parent_answer_id) {
        const parent = byId[a.parent_answer_id];
        if (parent) parent.children.push(a);
        else roots.push(a);
      } else {
        roots.push(a);
      }
    });

    const highlighted = highlightedAnswers.map((a) => byId[a.id]).filter(Boolean);
    const otherRoots = roots.filter((r) => !highlightedIds.has(r.id));

    return res.json({ highlightedAnswers: highlighted, otherAnswers: otherRoots });
  } catch (err) {
    console.error("listAnswers error", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

// ----------------- createAnswer (modified emission behavior for banned answers) -----------------
export const createAnswer = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const { content, image, parent_answer_id } = req.body;
    const senderId = req.user.id;

    const question = await Question.findByPk(questionId, { transaction: t });
    if (!question) { await t.rollback(); return res.status(404).json({ error: "Question not found" }); }

    const thread = await Thread.findByPk(question.thread_id, { transaction: t });
    if (!thread) { await t.rollback(); return res.status(404).json({ error: "Thread not found" }); }

    const { isGlobal, role } = await getUserForumRole(senderId, thread.forum_id);
    if (!(isGlobal || role === "member" || role === "forum_admin" || role === "global_admin")) {
      await t.rollback();
      return res.status(403).json({ error: "Join forum to reply" });
    }

    // check active ban
    const activeBan = await getActiveBan(thread.forum_id, senderId);
    if (activeBan) {
      await t.rollback();
      const expiresAt = activeBan.expires_at ? activeBan.expires_at : null;
      return res.status(403).json({ error: "User banned from posting in this forum", banned_until: expiresAt });
    }

    const image_url = await uploadIfPresent(image);

    const answer = await Answer.create({
      question_id: questionId,
      sender_id: senderId,
      content: content || "",
      image_url: image_url || null,
      parent_answer_id: parent_answer_id || null,
      // toxic fields will be updated after AI check
    }, { transaction: t });

    // Use the detailed AI classifier (returns {level, explanation})
    let toxicLevel = 1;
    let toxicExplanation = null;

    try {
      const aiContext = {
        question: { title: question.title, content: question.content || "" },
        thread: { title: thread.title }
      };
      const aiResult = await analyzeToxicityLevel(content || "", aiContext, 60000);
      toxicLevel = aiResult && aiResult.level ? aiResult.level : 1;
      console.log("\n\n\n\n\ aaaaaaa: ", toxicLevel);
      toxicExplanation = aiResult && aiResult.explanation ? aiResult.explanation : null;

      // Update answer record with level + explanation + toxic flag if level 3
      await answer.update({
        is_toxic: toxicLevel === 3,
        toxic_level: toxicLevel,
        toxic_explanation: toxicExplanation,
        toxic_checked_at: new Date()
      }, { transaction: t });

      // Create relevant forum audits
      if (toxicLevel === 3) {
        await ForumAudit.create({
          actor_id: senderId,
          forum_id: thread.forum_id,
          action: "flag_toxic_answer",
          meta: { answerId: answer.id, level: toxicLevel, explanation: toxicExplanation }
        }, { transaction: t });
      } else if (toxicLevel === 2) {
        // Medium: record an audit for moderator visibility but DO NOT mark as banned
        await ForumAudit.create({
          actor_id: senderId,
          forum_id: thread.forum_id,
          action: "flag_medium_toxic_answer",
          meta: { answerId: answer.id, level: toxicLevel, explanation: toxicExplanation }
        }, { transaction: t });
      }
    } catch (aiErr) {
      console.error("AI toxicity check failed:", aiErr);
      // don't fail request; leave default flags (is_toxic false) and toxic_level default
      await answer.update({
        toxic_checked_at: new Date(),
        toxic_level: 1,
        toxic_explanation: "ai-check-failed-or-unclear"
      }, { transaction: t });
    }

    await ForumAudit.create({
      actor_id: senderId,
      forum_id: thread.forum_id,
      action: "create_answer",
      meta: { answerId: answer.id }
    }, { transaction: t });

    await t.commit();

    // attach sender role for emitted payload
    const senderRoleRow = await ForumMember.findOne({ where: { forum_id: thread.forum_id, user_id: senderId } });
    const senderRole = senderRoleRow ? senderRoleRow.role : null;
    const answerJson = answer.toJSON();
    answerJson.senderRole = senderRole;
    const sender = await User.findByPk(senderId, { attributes: ["id", "username", "profilePic"] });
    answerJson.senderName = sender?.username || null;
    answerJson.senderProfilePic = sender?.profilePic || null;
    // include AI metadata so UI can display moderation hints if desired
    answerJson.toxic_level = toxicLevel;
    answerJson.toxic_explanation = toxicExplanation;

    // IMPORTANT: only treat level 3 as "banned" (do not broadcast / show to others)
    if (toxicLevel === 3) {
      try {
        const socketId = getRecipientSocketId(String(senderId));
        if (socketId) {
          io.to(socketId).emit("new_answer", { answer: answerJson, banned: true });
        }
        // do NOT emit question_answer_delta or thread-level delta to avoid incrementing counts for other users
      } catch (emitErr) {
        console.warn("Failed to emit banned answer privately:", emitErr);
      }
    } else {
      // Normal flow: broadcast the new answer to question room and thread delta
      io.to(`question_${questionId}`).emit("new_answer", { answer: answerJson });
      io.to(`thread_${thread.id}`).emit("question_answer_delta", { questionId, delta: 1 });
    }

    // notify question owner
    if (question.creator_id && question.creator_id !== senderId) {
      const ownerSocket = getRecipientSocketId(String(question.creator_id));
      if (ownerSocket) io.to(ownerSocket).emit("new_answer_for_owner", { questionId, answerId: answer.id, from: senderId });
    }

    return res.status(201).json(answerJson);
  } catch (err) {
    await t.rollback();
    console.error("createAnswer error", err);
    return res.status(500).json({ error: err.message });
  }
};


/**
 * updateAnswer
 */
export const updateAnswer = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const answerId = parseInt(req.params.answerId, 10);
    const { content, image } = req.body;
    const answer = await Answer.findByPk(answerId, { transaction: t });
    if (!answer) { await t.rollback(); return res.status(404).json({ error: "Answer not found" }); }

    const q = await Question.findByPk(answer.question_id, { transaction: t });
    const thread = await Thread.findByPk(q.thread_id, { transaction: t });
    const { isGlobal, role } = await getUserForumRole(req.user.id, thread.forum_id);
    const isAdmin = isGlobal || role === "forum_admin" || role === "global_admin";
    const isOwner = answer.sender_id === req.user.id;
    if (!isOwner && !isAdmin) { await t.rollback(); return res.status(403).json({ error: "Not allowed to update answer" }); }

    let image_url = answer.image_url;
    if (image) image_url = await uploadIfPresent(image);

    await answer.update({ content: content ?? answer.content, image_url }, { transaction: t });
    await ForumAudit.create({ actor_id: req.user.id, forum_id: thread.forum_id, action: "update_answer", meta: { answerId } }, { transaction: t });
    await t.commit();

    io.to(`question_${answer.question_id}`).emit("answer_updated", { answer });
    return res.json(answer);
  } catch (err) {
    await t.rollback();
    console.error("updateAnswer error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * deleteAnswer
 */
export const deleteAnswer = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const answerId = parseInt(req.params.answerId, 10);
    const answer = await Answer.findByPk(answerId, { transaction: t });
    if (!answer) { await t.rollback(); return res.status(404).json({ error: "Answer not found" }); }

    const q = await Question.findByPk(answer.question_id, { transaction: t });
    const thread = await Thread.findByPk(q.thread_id, { transaction: t });
    const { isGlobal, role } = await getUserForumRole(req.user.id, thread.forum_id);
    const isAdmin = isGlobal || role === "forum_admin" || role === "global_admin";
    const isOwner = answer.sender_id === req.user.id;
    if (!isOwner && !isAdmin) { await t.rollback(); return res.status(403).json({ error: "Not allowed to delete answer" }); }

    // optionally remove image
    if (answer.image_url) {
      try {
        const parts = answer.image_url.split("/");
        const file = parts[parts.length - 1];
        const publicId = file.split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (e) { /* ignore */ }
    }

    await answer.destroy({ transaction: t });
    await ForumAudit.create({ actor_id: req.user.id, forum_id: thread.forum_id, action: "delete_answer", meta: { answerId } }, { transaction: t });
    await t.commit();

    // emit deletion to question room so question viewers remove it
    io.to(`question_${answer.question_id}`).emit("answer_deleted", { answerId });

    // Also emit a delta event to the thread room so the left-list badges decrement
    io.to(`thread_${thread.id}`).emit("question_answer_delta", { questionId: answer.question_id, delta: -1 });

    return res.json({ success: true });
  } catch (err) {
    await t.rollback();
    console.error("deleteAnswer error", err);
    return res.status(500).json({ error: err.message });
  }
};


/**
 * listUserQuestionsWithUnseen
 * GET /api/forum/users/:userId/questions
 *
 * Only accessible by the user themself or global admin.
 */
export const listUserQuestionsWithUnseen = async (req, res) => {
  try {
    const userIdParam = parseInt(req.params.userId, 10);
    if (!userIdParam) return res.status(400).json({ error: "userId required" });

    // permission: if requester is not the user, require global admin
    if (req.user.id !== userIdParam && !req.user?.is_global_admin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    // get user's questions
    const questions = await Question.findAll({
      where: { creator_id: userIdParam },
      order: [["createdAt", "DESC"]],
    });

    const qIds = questions.map((q) => q.id);
    if (qIds.length === 0) return res.json([]);

    // batch answer counts per question
    const answerCounts = await Answer.findAll({
      where: { question_id: { [Op.in]: qIds } },
      attributes: ["question_id", [Sequelize.fn("COUNT", Sequelize.col("id")), "answerCount"]],
      group: ["question_id"],
      raw: true,
    });
    const answerCountMap = {};
    answerCounts.forEach((r) => { answerCountMap[r.question_id] = parseInt(r.answerCount, 10); });

    // batch view counts by this user grouped by question (join AnswerView -> Answer)
    const viewCounts = await AnswerView.findAll({
      where: { user_id: userIdParam },
      include: [{ model: Answer, attributes: ["question_id"], required: true }],
      attributes: [[Sequelize.fn("COUNT", Sequelize.col("AnswerView.id")), "viewCount"], [Sequelize.col("Answer.question_id"), "question_id"]],
      group: ["Answer.question_id"],
      raw: true,
    });
    const viewCountMap = {};
    viewCounts.forEach((r) => { viewCountMap[r.question_id] = parseInt(r.viewCount || 0, 10); });

    // map questions
    const out = questions.map((q) => {
      const totalAnswers = answerCountMap[q.id] || 0;
      const viewed = viewCountMap[q.id] || 0;
      const unseenCount = Math.max(0, totalAnswers - viewed);
      return { ...q.toJSON(), unseenCount };
    });

    return res.json(out);
  } catch (err) {
    console.error("listUserQuestionsWithUnseen error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * getUnseenCount
 */
export const getUnseenCount = async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const userId = req.user.id;

    // Get total answers for question
    const totalAnswers = await Answer.count({ where: { question_id: questionId } });

    if (totalAnswers === 0) return res.json({ unseenCount: 0 });

    // Get count of answers that the user has seen in that question
    const views = await AnswerView.findAll({
      where: { user_id: userId },
      include: [{ model: Answer, attributes: ["question_id"], where: { question_id: questionId }, required: true }],
      attributes: [[Sequelize.fn("COUNT", Sequelize.col("AnswerView.id")), "viewCount"]],
      raw: true,
    });

    const viewed = views.length > 0 ? parseInt(views[0].viewCount || 0, 10) : 0;
    const unseenCount = Math.max(0, totalAnswers - viewed);

    return res.json({ unseenCount });
  } catch (err) {
    console.error("getUnseenCount error", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * markAnswersSeen
 * improve: do single bulk lookup for existing views, then bulkCreate missing AnswerView rows
 */
export const markAnswersSeen = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.id;
    const questionId = parseInt(req.params.questionId, 10);

    const answers = await Answer.findAll({ where: { question_id: questionId }, transaction: t });
    const answerIds = answers.map((a) => a.id);
    if (answerIds.length === 0) { await t.rollback(); return res.json({ marked: 0 }); }

    // find existing views for this user and these answers
    const existingViews = await AnswerView.findAll({
      where: { answer_id: { [Op.in]: answerIds }, user_id: userId },
      attributes: ["answer_id"],
      transaction: t,
      raw: true,
    });
    const existingSet = new Set(existingViews.map((r) => r.answer_id));

    const toInsert = [];
    for (const aid of answerIds) {
      if (!existingSet.has(aid)) {
        toInsert.push({ answer_id: aid, user_id: userId, seen_at: new Date() });
      }
    }

    if (toInsert.length > 0) {
      await AnswerView.bulkCreate(toInsert, { transaction: t });
    }

    // audit
    const question = await Question.findByPk(questionId, { transaction: t });
    const thread = question ? await Thread.findByPk(question.thread_id, { transaction: t }) : null;
    await ForumAudit.create({ actor_id: userId, forum_id: thread ? thread.forum_id : null, action: "mark_answers_seen", meta: { questionId, count: toInsert.length } }, { transaction: t });

    await t.commit();

    io.to(`question_${questionId}`).emit("answers_marked_seen", { questionId, userId, marked: toInsert.length });
    return res.json({ marked: toInsert.length });
  } catch (err) {
    await t.rollback();
    console.error("markAnswersSeen error", err);
    return res.status(500).json({ error: err.message });
  }
};


// List forum members with basic user info
export const listForumMembers = async (req, res) => {
  const forumId = Number(req.params.forumId);
  try {
    // authorization: allow if the user is global admin OR a forum member
    const isGlobalAdmin = !!req.user?.is_global_admin;
    if (!isGlobalAdmin) {
      // check membership
      const membership = await ForumMember.findOne({ where: { forum_id: forumId, user_id: req.user.id }});
      if (!membership) return res.status(403).json({ error: "Not allowed" });
    }

    const rows = await ForumMember.findAll({
      where: { forum_id: forumId },
      include: [{ model: User, attributes: ['id','name','username','profilePic','position'] }],
      order: [['joined_at','ASC']]
    });

    // map to friendly shape
    const members = rows.map(r => ({
      user: {
        id: r.User.id,
        name: r.User.name,
        username: r.User.username,
        profilePic: r.User.profilePic,
        position: r.User.position
      },
      role: r.role,
      joined_at: r.joined_at
    }));

    return res.json(members);
  } catch (err) {
    console.error("listForumMembers error", err);
    return res.status(500).json({ error: "Failed to list members" });
  }
};

// update role for a forum member (promote/revoke)
// restricted to global admins via router middleware
export const updateMemberRole = async (req, res) => {
  const forumId = Number(req.params.forumId);
  const userId = Number(req.params.userId);
  const { role } = req.body;

  try {
    // validate role
    const allowed = ['member', 'forum_admin'];
    if (!allowed.includes(role)) return res.status(400).json({ error: "Invalid role" });

    const membership = await ForumMember.findOne({ where: { forum_id: forumId, user_id: userId }});
    if (!membership) return res.status(404).json({ error: "Member not found" });

    membership.role = role;
    await membership.save();

    // return updated membership including basic user info
    const u = await User.findByPk(userId, { attributes: ['id','name','username','profilePic','position'] });
    return res.json({ user: u, role: membership.role, joined_at: membership.joined_at });
  } catch (err) {
    console.error("updateMemberRole error", err);
    return res.status(500).json({ error: "Failed to update role" });
  }
};

// remove member from forum (global admin only)
export const removeForumMember = async (req, res) => {
  const forumId = Number(req.params.forumId);
  const userId = Number(req.params.userId);

  try {
    const membership = await ForumMember.findOne({ where: { forum_id: forumId, user_id: userId }});
    if (!membership) return res.status(404).json({ error: "Member not found" });

    await membership.destroy();

    // decrement forum member_count if it's present
    await Forum.decrement('member_count', { by: 1, where: { id: forumId } });

    return res.status(204).send(); // no content
  } catch (err) {
    console.error("removeForumMember error", err);
    return res.status(500).json({ error: "Failed to remove member" });
  }
};


// ---------------- list toxic users + recommendation ----------------
export const listToxicUsers = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    if (!forumId) return res.status(400).json({ error: "forumId required" });

    // Only return users who have answers in this forum that were flagged is_toxic = true
    // IMPORTANT: set required: true to force INNER JOIN on Question and Thread so the
    // aggregation only counts answers that belong to threads of this forum.
    const rows = await Answer.findAll({
      attributes: [
        'sender_id',
        [Sequelize.fn('COUNT', Sequelize.col('Answer.id')), 'toxic_count'],
        [Sequelize.fn('MAX', Sequelize.col('Answer.toxic_checked_at')), 'last_toxic_at']
      ],
      include: [{
        model: Question,
        attributes: [],
        required: true, // <- force inner join
        include: [{
          model: Thread,
          attributes: [],
          required: true, // <- force inner join
          where: { forum_id: forumId }
        }]
      }],
      where: { is_toxic: true },
      group: ['Answer.sender_id'],
      order: [[Sequelize.literal('toxic_count'), 'DESC']],
      raw: true
    });

    const userIds = rows.map(r => r.sender_id);
    const users = userIds.length ? await User.findAll({ where: { id: userIds }, attributes: ['id','username','profilePic'] }) : [];
    const byId = {};
    users.forEach(u => byId[u.id] = u);

    const result = rows.map(r => {
      const count = Number(r.toxic_count || 0);
      const rec = recommendBanByCount(count);
      return {
        userId: r.sender_id,
        username: byId[r.sender_id]?.username || null,
        profilePic: byId[r.sender_id]?.profilePic || null,
        toxic_count: count,
        last_toxic_at: r.last_toxic_at,
        recommended_ban: rec // { duration: "7d", label: "7 days" }
      };
    });

    return res.json({ list: result });
  } catch (err) {
    console.error("listToxicUsers error", err);
    return res.status(500).json({ error: err.message });
  }
};

// ---------------- list current banned users in a forum ----------------
export const listBannedUsers = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);

    const now = new Date();
    const bans = await ForumBan.findAll({
      where: {
        forum_id: forumId,
        lifted_at: null,
        [Op.or]: [
          { expires_at: null },
          { expires_at: { [Op.gt]: now } }
        ]
      },
      include: [{ model: User, attributes: ['id','username','profilePic'] }],
      order: [['start_at', 'DESC']]
    });

    const list = bans.map(b => ({
      banId: b.id,
      userId: b.user_id,
      username: b.User?.username || null,
      profilePic: b.User?.profilePic || null,
      start_at: b.start_at,
      expires_at: b.expires_at,
      reason: b.reason,
      banned_by: b.banned_by
    }));

    return res.json({ list });
  } catch (err) {
    console.error("listBannedUsers error", err);
    return res.status(500).json({ error: err.message });
  }
};

// ---------------- ban a member (already present) ----------------
export const banForumMember = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = parseInt(req.params.userId, 10);
    const adminId = req.user.id;
    const { duration = "7d", reason = null } = req.body;

    const { isGlobal, role } = await getUserForumRole(adminId, forumId);
    if (!(isGlobal || role === 'forum_admin' || role === 'global_admin')) return res.status(403).json({ error: "Must be forum admin to ban" });

    const durationMs = durationToMs(duration);
    const banRow = await createBan({ forumId, userId, bannedBy: adminId, reason, durationMs });

    await ForumAudit.create({
      actor_id: adminId,
      forum_id: forumId,
      action: "ban_user",
      meta: { userId, banId: banRow.id, duration, reason }
    });

    // --- NEW: emit realtime events to affected user and forum room ---
    try {
      const payload = {
        forumId,
        userId,
        ban: {
          id: banRow.id,
          start_at: banRow.start_at,
          expires_at: banRow.expires_at,
          reason: banRow.reason,
          banned_by: banRow.banned_by
        },
        message: "You have been banned from the forum"
      };

      // target the affected user (normalize key to string to avoid type mismatch)
      const recipientSocketId = getRecipientSocketId(String(userId));
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("forum_banned", payload);
      }

      // optional: notify the forum room (admins/members) about the ban
      io.to(`forum_${forumId}`).emit("forum_ban_event", {
        forumId,
        userId,
        bannedBy: adminId,
        banId: banRow.id,
        start_at: banRow.start_at,
        expires_at: banRow.expires_at,
      });
    } catch (emitErr) {
      console.warn("Failed to emit forum_banned:", emitErr);
    }
    // --- end realtime emit ---

    return res.status(201).json({ success: true, ban: { id: banRow.id, expires_at: banRow.expires_at } });
  } catch (err) {
    console.error("banForumMember error", err);
    return res.status(500).json({ error: err.message });
  }
};

// ---------------- unban a specific member (must be member of forum) ----------------
export const unbanForumMember = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = parseInt(req.params.userId, 10);
    const adminId = req.user.id;

    const { isGlobal, role } = await getUserForumRole(adminId, forumId);
    if (!(isGlobal || role === 'forum_admin' || role === 'global_admin')) return res.status(403).json({ error: "Must be forum admin to unban" });

    // ensure the target user is still a forum member (your requirement)
    const memberRow = await ForumMember.findOne({ where: { forum_id: forumId, user_id: userId } });
    if (!memberRow) return res.status(400).json({ error: "Target user is not a member of this forum" });

    const count = await liftBan(forumId, userId, adminId);
    await ForumAudit.create({
      actor_id: adminId,
      forum_id: forumId,
      action: "unban_user",
      meta: { userId, lifted_count: count }
    });

    // --- NEW: emit realtime events to affected user and forum room ---
    try {
      const payload = {
        forumId,
        userId,
        message: "Your ban has been lifted"
      };

      const recipientSocketId = getRecipientSocketId(String(userId));
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("forum_unbanned", payload);
      }

      io.to(`forum_${forumId}`).emit("forum_unban_event", {
        forumId,
        userId,
        liftedBy: adminId
      });
    } catch (emitErr) {
      console.warn("Failed to emit forum_unbanned:", emitErr);
    }
    // --- end realtime emit ---

    return res.json({ success: true, lifted: count });
  } catch (err) {
    console.error("unbanForumMember error", err);
    return res.status(500).json({ error: err.message });
  }
};

// ---------------- check ban status (useful for admin UI) ----------------
export const checkUserBanStatus = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = parseInt(req.params.userId, 10);
    const ban = await getActiveBan(forumId, userId);
    if (!ban) return res.json({ banned: false });
    return res.json({
      banned: true,
      ban: {
        id: ban.id,
        start_at: ban.start_at,
        expires_at: ban.expires_at,
        reason: ban.reason,
        banned_by: ban.banned_by
      }
    });
  } catch (err) {
    console.error("checkUserBanStatus error", err);
    return res.status(500).json({ error: err.message });
  }
};


// list toxic answers for a given user within a forum
export const listToxicAnswersForUser = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = parseInt(req.params.userId, 10);
    if (!forumId || !userId) return res.status(400).json({ error: "forumId and userId required" });

    // Use Sequelize associations: Answer -> Question -> Thread
    // Put the forum filter on the nested include (Thread.where) and force INNER JOINs
    const answers = await Answer.findAll({
      where: { sender_id: userId, is_toxic: true },
      include: [
        {
          model: Question,
          attributes: ['id', 'title', 'thread_id'],
          required: true, // <- force inner join
          include: [
            {
              model: Thread,
              attributes: ['id', 'title', 'forum_id'],
              required: true, // <- force inner join
              where: { forum_id: forumId } // restrict to this forum
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 500
    });

    // map to frontend-friendly shape
    const results = (answers || []).map(a => {
      const aj = a.toJSON();
      const q = aj.Question || {};
      const t = q.Thread || {};
      return {
        id: aj.id,
        content: aj.content,
        createdAt: aj.createdAt,
        questionId: q.id || null,
        questionTitle: q.title || null,
        threadId: t.id || null,
        threadTitle: t.title || null,
      };
    });

    return res.json({ answers: results });
  } catch (err) {
    console.error("listToxicAnswersForUser error", err);
    return res.status(500).json({ error: err.message });
  }
};


// check ban status for current user (self)
export const checkMyBanStatus = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = req.user?.id;
    if (!forumId || !userId) return res.status(400).json({ error: "forumId required" });

    const ban = await getActiveBan(forumId, userId);
    if (!ban) return res.json({ banned: false });
    return res.json({
      banned: true,
      ban: {
        id: ban.id,
        start_at: ban.start_at,
        expires_at: ban.expires_at,
        reason: ban.reason,
        banned_by: ban.banned_by
      }
    });
  } catch (err) {
    console.error("checkMyBanStatus error", err);
    return res.status(500).json({ error: err.message });
  }
};


// ---------------- list full ban history for a user in a forum ----------------
export const listUserBanHistory = async (req, res) => {
  try {
    const forumId = parseInt(req.params.forumId, 10);
    const userId = parseInt(req.params.userId, 10);
    if (!forumId || !userId) return res.status(400).json({ error: "forumId and userId required" });

    // fetch all bans for this forum + user sorted by start_at desc
    const bans = await ForumBan.findAll({
      where: { forum_id: forumId, user_id: userId },
      order: [['start_at', 'DESC']],
      limit: 1000 // safe cap
    });

    // normalize structure for client
    const list = bans.map(b => ({
      id: b.id,
      forum_id: b.forum_id,
      user_id: b.user_id,
      banned_by: b.banned_by,
      reason: b.reason,
      start_at: b.start_at,
      expires_at: b.expires_at,
      lifted_at: b.lifted_at,
      created_at: b.created_at
    }));

    return res.json({ bans: list });
  } catch (err) {
    console.error("listUserBanHistory error", err);
    return res.status(500).json({ error: err.message });
  }
};