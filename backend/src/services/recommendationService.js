// services/recommendationService.js
import { Post } from "../models/postModel.js";
import { User } from "../models/userModel.js";
import { sequelize } from "../config/database.js";
import { AnalyzeUserTrendingForUserRecommendation } from "../gemini/useAI2.js";
import sanitizeTaxonomy from "../utils/sanitizeTaxonomy.js";
import NodeCache from "node-cache";

/**
 * Caches:
 * - aiCache: caches AI prediction per user
 * - interactionCache: expected to be set by socket.js as global.interactionCache
 *   (fallback to a local NodeCache if not set)
 */
const aiCache = global.aiCache || new NodeCache({ stdTTL: 60 * 60 * 24 });
global.aiCache = aiCache;

const interactionCache = global.interactionCache || new NodeCache({ stdTTL: 60 * 60 * 24 });
global.interactionCache = interactionCache;


/** Authoritative taxonomy list */
const TAXONOMY_LIST = [
  "Core Infrastructure & Operations",
  "Software & Application Development",
  "Data Engineering & Management",
  "Artificial Intelligence & Analytics",
  "Security & Operations Management",
  "Emerging Technologies",
];

// Weights
const PROFILE_WEIGHT = 2; // user's own post distribution
const TREND_WEIGHT = 3;   // global trending signal
const TRACK_WEIGHT = 5;   // tracking behavior weight (used only if interactions exist)

/** ----------------- Utilities ----------------- **/

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normTax(t) {
  const s = sanitizeTaxonomy(t || "");
  return TAXONOMY_LIST.includes(s) ? s : "";
}

/** ----------------- DB / Histogram helpers ----------------- **/

export async function getTrendingTopK(k = 3) {
  const rows = await Post.findAll({
    attributes: [
      "mainField",
      [sequelize.fn("COUNT", sequelize.col("mainField")), "count"]
    ],
    group: ["mainField"],
    order: [[sequelize.literal("count"), "DESC"]],
    raw: true,
    limit: k
  });
  return rows.map(r => r.mainField);
}

function computeProfileDistributionFromPosts(userPosts) {
  const counts = {};
  let total = 0;
  for (const t of TAXONOMY_LIST) counts[t] = 0;
  if (!userPosts || userPosts.length === 0) return { counts, total: 0 };

  for (const p of userPosts) {
    const mf = normTax(p.mainField);
    if (mf) {
      counts[mf] = (counts[mf] || 0) + 1;
      total++;
    }
  }
  return { counts, total };
}

/**
 * buildTrackingHistogramForUser
 * - Reads interactionCache[`interactions:${userId}`]
 * - Aggregates unique (actorId|postId) pairs and counts per mainField
 * - Returns { counts: {...}, total }
 */
function buildTrackingHistogramForUser(userId) {
  const out = {};
  TAXONOMY_LIST.forEach(t => (out[t] = 0));
  const arr = interactionCache.get(`interactions:${userId}`) || [];
  if (!arr || arr.length === 0) return { counts: out, total: 0 };

  const seen = new Set();
  let total = 0;
  for (const ev of arr) {
    if (!ev) continue;
    const key = `${ev.actorId}|${ev.postId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mf = normTax(ev.mainField || "");
    if (mf) {
      out[mf] = (out[mf] || 0) + 1;
      total++;
    }
  }
  return { counts: out, total };
}

/** ----------------- Scoring ----------------- */

/**
 * computeTaxonomyScores
 * - Uses profile + trending + tracking (if present).
 * - If tracking data is absent, tracking term contributes 0 and we rely on profile & trending only.
 */
export async function computeTaxonomyScores({ user, userRecentPosts = [], followingIds = [] }) {
  const userId = user?.id || 0;

  // 1) profile distribution
  const { counts: postCounts, total: postTotal } = computeProfileDistributionFromPosts(userRecentPosts);

  // 2) AI prediction (single taxonomy or "")
  const cacheKey = `predictTrending:${userId}`;
  let aiPredict = aiCache.get(cacheKey) || "";
  if (!aiPredict) {
    try {
      aiPredict = await AnalyzeUserTrendingForUserRecommendation(user, userRecentPosts, { timeoutMs: 3500 });
      console.log("\n\n\naiPredict: ",aiPredict)
      if (typeof aiPredict === "string") aiPredict = aiPredict.trim();
      else aiPredict = "";
      if (!TAXONOMY_LIST.includes(aiPredict)) aiPredict = "";
      aiCache.set(cacheKey, aiPredict);
    } catch (err) {
      aiPredict = "";
    }
  }

  // 3) profile score
  const score_profile = {};
  if (postTotal === 0) {
    TAXONOMY_LIST.forEach(t => (score_profile[t] = (aiPredict && aiPredict === t) ? PROFILE_WEIGHT : 0));
  } else {
    for (const t of TAXONOMY_LIST) {
      const base = ((postCounts[t] || 0) / postTotal) * PROFILE_WEIGHT; // base = analyze user's posts
      const aiBonus = (aiPredict && aiPredict === t) ? (PROFILE_WEIGHT * 0.5) : 0; // aiBonus = use AI analyze user profile + post
      score_profile[t] = Math.min(PROFILE_WEIGHT, base + aiBonus);

      console.log("\n\n base: ",base)
      console.log("aiBonus : ", aiBonus)
      console.log("score_profile[t] : ", score_profile[t])
    }
  }

  // 4) trending score
  const trending = await getTrendingTopK(3);
  const score_trend = {};
  TAXONOMY_LIST.forEach(t => {
    if (trending[0] === t) score_trend[t] = 3;
    else if (trending[1] === t) score_trend[t] = 2;
    else if (trending[2] === t) score_trend[t] = 1;
    else score_trend[t] = 0;
  });

  // 5) tracking behavior (or zero if none)
  const score_follow = {};
  let usingTracking = false;
  try {
    const { counts: trackCounts, total: trackTotal } = buildTrackingHistogramForUser(userId);
    if (trackTotal > 0) {
      usingTracking = true;
      const maxTrack = Math.max(...Object.values(trackCounts), 0);
      TAXONOMY_LIST.forEach(t => {
        score_follow[t] = maxTrack > 0 ? (trackCounts[t] / maxTrack) * TRACK_WEIGHT : 0;
      });
    } else {
      // no tracking interactions -> no follow-like signal is used (score_follow remains 0)
      TAXONOMY_LIST.forEach(t => (score_follow[t] = 0));
    }
  } catch (err) {
    console.warn("Tracking histogram error, using zero track weight:", err);
    TAXONOMY_LIST.forEach(t => (score_follow[t] = 0));
  }

  // 6) combine and compute levels
  const totalScore = {};
  const levels = {};
  for (const t of TAXONOMY_LIST) {
    console.log(`\n\n\n\n\n score_profile[t] for : ${t}`, score_profile[t])
    console.log(`\n\n\n\n\n score_follow[t] for : ${t}`, score_follow[t])
    const s = parseFloat((score_profile[t] + score_trend[t] + score_follow[t]).toFixed(4));
    const clamped = Math.max(0, Math.min(10, s));
    totalScore[t] = clamped;
    let level = 1;
    if (clamped >= 8) level = 5;
    else if (clamped >= 6) level = 4;
    else if (clamped >= 4) level = 3;
    else if (clamped >= 2) level = 2;
    else level = 1;
    levels[t] = level;
  }

  return { totalScore, levels, breakdown: { score_profile, score_trend, score_follow, usingTracking }, trending, aiPredict };
}

/** ----------------- Recommendation selection ----------------- */

/**
 * getRecommendations
 * - Picks up to desiredTotal posts from highest and second-highest taxonomies.
 * - Prioritization (within level):
 *    1) posts your followings interacted with (tracked)
 *    2) posts liked by followings
 *    3) other posts
 * - Excludes posts authored by user or by user's followings and posts user already liked.
 */
export async function getRecommendations({
  user,
  userRecentPosts = [],
  followingIds = [],
  term = "Knowledge",
  desiredTotal = 4,
  perLevelPick = { highest: 2, second: 2 }
} = {}) {
  const currentUserId = user?.id || 0;
  followingIds = Array.isArray(followingIds) ? followingIds : [];

  const { totalScore, levels } = await computeTaxonomyScores({ user, userRecentPosts, followingIds });

  // group taxonomies by level
  const levelToTaxonomies = {};
  for (const t of Object.keys(levels)) {
    const lvl = levels[t];
    levelToTaxonomies[lvl] = levelToTaxonomies[lvl] || [];
    levelToTaxonomies[lvl].push(t);
  }

  const presentLevels = Object.keys(levelToTaxonomies).map(x => parseInt(x, 10)).sort((a, b) => b - a);
  if (presentLevels.length === 0) return [];
  const highestLevel = presentLevels[0];
  const secondLevel = presentLevels.length > 1 ? presentLevels[1] : presentLevels[0];

  // fetch candidate posts for chosen taxonomies (exclude authored by user / followings; exclude posts user already liked)
  const candidateMap = new Map();
  const perTaxLimit = 50;

  async function fetchPostsForTaxonomies(taxonomies) {
    for (const tax of taxonomies) {
      const rows = await Post.findAll({
        where: sequelize.and(
          { type: term, mainField: tax },
          // exclude posts current user already liked
          sequelize.literal(`NOT EXISTS (SELECT 1 FROM postlikes pl WHERE pl.post_id = Post.id AND pl.user_id = ${currentUserId})`)
        ),
        include: [
          { model: User, as: "Owners", attributes: ["id", "username", "profilePic", "isFrozen"], through: { attributes: [] }, where: {isFrozen: false } },
          { model: User, as: "LikedByUsers", attributes: ["id"], through: { attributes: [] } }
        ],
        attributes: {
          include: [
            [sequelize.literal(`(SELECT COUNT(*) FROM postlikes WHERE postlikes.post_id = Post.id)`), "TotalLikeNumber"],
            [sequelize.literal(`(SELECT COUNT(*) FROM postreplies WHERE postreplies.post_id = Post.id)`), "TotalRepliesNumber"]
          ],
        },
        order: [[sequelize.literal('TotalLikeNumber'), 'DESC'], ['createdAt', 'DESC']],
        limit: perTaxLimit,
        raw: false,
      });

      for (const r of rows) {
        if (!r) continue;
        const js = typeof r.toJSON === "function" ? r.toJSON() : r;

        // normalize Owners and LikedByUsers
        js.Owners = js.Owners && Array.isArray(js.Owners) ? js.Owners.map(o => ({ id: o.id, username: o.username, profilePic: o.profilePic, isFrozen: o.isFrozen })) : [];
        js.LikedByUsers = js.LikedByUsers && Array.isArray(js.LikedByUsers) ? js.LikedByUsers.map(u => ({ id: u.id })) : [];

        // skip candidate posts that belong to frozen owners
        if ((js.Owners || []).some(o => o.isFrozen)) continue;

        const ownerIds = js.Owners.map(o => o.id);
        const isByUser = ownerIds.includes(currentUserId);
        const isByFollowing = ownerIds.some(id => followingIds.includes(id));
        if (isByUser || isByFollowing) continue;

        if (!candidateMap.has(js.id)) candidateMap.set(js.id, js);
      }
    }
  }

  await fetchPostsForTaxonomies(levelToTaxonomies[highestLevel] || []);
  if (secondLevel !== highestLevel) await fetchPostsForTaxonomies(levelToTaxonomies[secondLevel] || []);
  if (candidateMap.size < desiredTotal) {
    const remainingLevels = presentLevels.slice(2);
    for (const lvl of remainingLevels) {
      await fetchPostsForTaxonomies(levelToTaxonomies[lvl] || []);
      if (candidateMap.size >= desiredTotal) break;
    }
  }

  const candidates = Array.from(candidateMap.values());
  if (candidates.length === 0) return [];

  // Build interacted map from interactionCache for this user: postId -> set(actorId)
  const interactedMap = new Map();
  try {
    const events = interactionCache.get(`interactions:${currentUserId}`) || [];
    for (const ev of events) {
      if (!ev || !ev.postId) continue;
      const postKey = String(ev.postId);
      if (!interactedMap.has(postKey)) interactedMap.set(postKey, new Set());
      if (!followingIds || followingIds.length === 0 || followingIds.includes(ev.actorId)) {
        interactedMap.get(postKey).add(ev.actorId);
      }
    }
  } catch (err) {
    console.warn("Failed to build interactedMap from cache:", err);
  }

  // compute metrics for candidates (includes interactedByFollowCount)
  const metricsMap = new Map();
  for (const p of candidates) {
    const likedByFollowCount = (p.LikedByUsers || []).reduce((acc, u) => acc + (followingIds.includes(u.id) ? 1 : 0), 0);
    const totalLikes = parseInt(p.TotalLikeNumber || 0, 10);
    const taxLevel = levels[normTax(p.mainField || "")] || 1;

    const interactedSet = interactedMap.get(String(p.id)) || new Set();
    const interactedByFollowCount = interactedSet.size;

    metricsMap.set(p.id, { likedByFollowCount, totalLikes, taxLevel, interactedByFollowCount });
  }

  // pick function: prioritize interacted -> liked -> others
  function pickFromLevels(allowedLevelsSet, n, excludedIds = new Set()) {
    const pool = candidates.filter(p => {
      const m = metricsMap.get(p.id);
      return m && allowedLevelsSet.has(m.taxLevel) && !excludedIds.has(p.id);
    });

    const interacted = pool
      .filter(p => metricsMap.get(p.id).interactedByFollowCount > 0)
      .sort((a, b) => {
        const ma = metricsMap.get(a.id), mb = metricsMap.get(b.id);
        if (mb.interactedByFollowCount !== ma.interactedByFollowCount) return mb.interactedByFollowCount - ma.interactedByFollowCount;
        return mb.totalLikes - ma.totalLikes;
      });

    const likedByFollow = pool
      .filter(p => metricsMap.get(p.id).interactedByFollowCount === 0 && metricsMap.get(p.id).likedByFollowCount > 0)
      .sort((a, b) => metricsMap.get(b.id).totalLikes - metricsMap.get(a.id).totalLikes);

    const others = pool
      .filter(p => metricsMap.get(p.id).interactedByFollowCount === 0 && metricsMap.get(p.id).likedByFollowCount === 0)
      .sort((a, b) => metricsMap.get(b.id).totalLikes - metricsMap.get(a.id).totalLikes);

    const out = [];
    for (const p of interacted) {
      if (out.length >= n) break;
      out.push(p);
    }
    for (const p of likedByFollow) {
      if (out.length >= n) break;
      out.push(p);
    }
    for (const p of others) {
      if (out.length >= n) break;
      out.push(p);
    }
    return out;
  }

  const pickHighest = perLevelPick.highest || 2;
  const pickSecond = perLevelPick.second || 2;

  const chosenIds = new Set();

  const highestCandidates = pickFromLevels(new Set([highestLevel]), pickHighest, chosenIds);
  highestCandidates.forEach(p => chosenIds.add(p.id));

  let secondCandidates = pickFromLevels(new Set([secondLevel]), pickSecond, chosenIds);
  secondCandidates.forEach(p => chosenIds.add(p.id));

  if (secondCandidates.length < pickSecond) {
    const needed = pickSecond - secondCandidates.length;
    const otherLevels = presentLevels.filter(l => l !== highestLevel && l !== secondLevel);
    for (const lvl of otherLevels) {
      if (secondCandidates.length >= pickSecond) break;
      const fill = pickFromLevels(new Set([lvl]), needed, chosenIds);
      for (const p of fill) {
        if (!chosenIds.has(p.id)) {
          secondCandidates.push(p);
          chosenIds.add(p.id);
          if (secondCandidates.length >= pickSecond) break;
        }
      }
    }
  }

  if (secondCandidates.length < pickSecond) {
    const needed = pickSecond - secondCandidates.length;
    const moreFromHighest = pickFromLevels(new Set([highestLevel]), needed, chosenIds);
    for (const p of moreFromHighest) {
      if (!chosenIds.has(p.id)) {
        secondCandidates.push(p);
        chosenIds.add(p.id);
      }
    }
  }

  // combine
  const finalRecs = [];
  const addIfNotPresent = (arr) => {
    for (const p of arr) {
      if (!finalRecs.some(x => x.id === p.id)) finalRecs.push(p);
      if (finalRecs.length >= desiredTotal) break;
    }
  };
  addIfNotPresent(highestCandidates);
  addIfNotPresent(secondCandidates);

  // fallback fill
  if (finalRecs.length < desiredTotal) {
    const remaining = candidates
      .filter(p => !finalRecs.some(r => r.id === p.id))
      .sort((a, b) => metricsMap.get(b.id).totalLikes - metricsMap.get(a.id).totalLikes);
    for (const p of remaining) {
      finalRecs.push(p);
      if (finalRecs.length >= desiredTotal) break;
    }
  }

  shuffleArray(finalRecs);

  const out = finalRecs
  .filter(p => !(p.Owners || []).some(o => o.isFrozen)) // remove frozen-owned posts just in case
  .map(p => {
    const likedUserIds = (p.LikedByUsers || []).map(u => u.id);
    return {
      ...p,
      Owners: p.Owners,
      LikedUserIds: likedUserIds,
      recommend: true,
      _taxonomy_level: levels[normTax(p.mainField || "")] || 1,
    };
  });

  // unique & trim
  const unique = [];
  const seen = new Set();
  for (const item of out) {
    if (seen.has(item.id)) continue;
    unique.push(item);
    seen.add(item.id);
    if (unique.length >= desiredTotal) break;
  }

  return unique;
}
