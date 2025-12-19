// src/services/forumBanService.js
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import { ForumBan } from "../models/forumModel.js";

/**
 * getActiveBan
 * - Returns the active ban row for (forumId, userId) or null
 * - Active means: lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now)
 */
export async function getActiveBan(forumId, userId) {
  const now = new Date();
  const ban = await ForumBan.findOne({
    where: {
      forum_id: forumId,
      user_id: userId,
      lifted_at: null,
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: now } }
      ]
    },
    order: [['start_at', 'DESC']],
  });
  return ban;
}

/**
 * createBan
 * - forumId, userId: required
 * - bannedBy: admin id who applied ban (optional)
 * - reason: optional text
 * - durationMs: number milliseconds or null for forever
 *
 * Returns created ForumBan instance.
 */
export async function createBan({ forumId, userId, bannedBy = null, reason = null, durationMs = null }) {
  const t = await sequelize.transaction();
  try {
    const start_at = new Date();
    let expires_at = null;
    if (durationMs && typeof durationMs === "number") {
      expires_at = new Date(start_at.getTime() + durationMs);
    }
    const ban = await ForumBan.create({
      forum_id: forumId,
      user_id: userId,
      banned_by: bannedBy,
      reason,
      start_at,
      expires_at,
      lifted_at: null,
      created_at: start_at
    }, { transaction: t });

    await t.commit();
    return ban;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * liftBan
 * - marks all active bans for (forumId, userId) as lifted (sets lifted_at = now)
 * - returns number of rows updated
 */
export async function liftBan(forumId, userId) {
  const now = new Date();
  const [count] = await ForumBan.update(
    { lifted_at: now },
    {
      where: {
        forum_id: forumId,
        user_id: userId,
        lifted_at: null
      }
    }
  );
  return count;
}


