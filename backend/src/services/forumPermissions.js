// src/services/forumPermissions.js
import { ForumMember } from "../models/forumModel.js";
import { User } from "../models/userModel.js";

/**
 * Returns: { isGlobal: boolean, role: 'member'|'forum_admin'|'global_admin'|null, membership: ForumMember|null }
 */
export async function getUserForumRole(userId, forumId) {
  if (!userId) return { isGlobal: false, role: null, membership: null };

  const user = await User.findByPk(userId, { attributes: ["id", "is_global_admin"] });
  const isGlobal = !!(user && user.is_global_admin);

  // Check membership for this forum
  const membership = await ForumMember.findOne({ where: { user_id: userId, forum_id: forumId } });
  if (membership) {
    return { isGlobal, role: membership.role, membership };
  }

  // Backwards-compatible: check for global_admin stored in forummembers
  const globalRow = await ForumMember.findOne({ where: { user_id: userId, role: "global_admin" } });
  if (globalRow) return { isGlobal, role: "global_admin", membership: null };

  return { isGlobal, role: null, membership: null };
}

/**
 * True if user is global admin OR has ForumMember row for forum (member/forum_admin/global_admin)
 */
export async function canViewForumContents(userId, forumId) {
  if (!userId) return false;
  const { isGlobal, role } = await getUserForumRole(userId, forumId);
  if (isGlobal) return true;
  if (role === "forum_admin" || role === "member" || role === "global_admin") return true;
  return false;
}
