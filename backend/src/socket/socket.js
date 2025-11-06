// socket.js
import { Server } from "socket.io";
import http from "http";
import express from "express";
import NodeCache from "node-cache";
import { Message, MessagesConversation, MessagesSender } from "../models/messageModel.js";
import { Notification } from "../models/notificationModel.js";
import { User } from "../models/userModel.js";
import { Post } from "../models/postModel.js";

/**
 * Interaction cache:
 * - global.interactionCache is used by recommendationService.js
 * - TTL = 24 hours (86400s)
 * - We cap per-follower list to last 500 entries to avoid unbounded memory growth.
 */
const INTERACTION_TTL = 60 * 60 * 24; // 24 hours
const INTERACTION_CAP = 500;

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// initialize or reuse global cache
const interactionCache = global.interactionCache || new NodeCache({ stdTTL: INTERACTION_TTL, checkperiod: 600 });
global.interactionCache = interactionCache;

const io = new Server(server, {
  cors: {
    origin: "http://localhost:4500",
    methods: ["GET", "POST"],
  },
});

export const getRecipientSocketId = (recipientId) => {
  return userSocketMap[recipientId];
};

const userSocketMap = {}; // userId -> socketId

io.on("connection", (socket) => {
  console.log("user connected", socket.id);

  // allow a client to join a room for a specific post:
  socket.on("joinPostRoom", ({ postId }) => {
    if (postId) socket.join(`post_${postId}`);
  });

  // optional: leave room on disconnect
  socket.on("leavePostRoom", ({ postId }) => {
    if (postId) socket.leave(`post_${postId}`);
  });

  // Forum real-time room
  socket.on("joinForumRoom", ({ forumId }) => {
    if (forumId) socket.join(`forum_${forumId}`);
  });
  socket.on("joinThreadRoom", ({ threadId }) => {
    if (threadId) socket.join(`thread_${threadId}`);
  });
  socket.on("joinQuestionRoom", ({ questionId }) => {
    if (questionId) socket.join(`question_${questionId}`);
  });

  // read userId from query (your client should pass it)
  const userId = socket.handshake.query.userId;

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
  }

  // broadcast online users map keys
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // handle mark messages as seen (existing)
  socket.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
    try {
      const messagesToUpdate = await Message.findAll({
        include: [
          {
            model: MessagesSender,
            as: "messagesSender",
            where: { user_id: userId },
            attributes: [],
          },
          {
            model: MessagesConversation,
            as: "messagesConversations",
            where: { conversation_id: conversationId },
            attributes: [],
          },
        ],
        where: { seen: false },
      });

      if (messagesToUpdate.length > 0) {
        await Message.update(
          { seen: true },
          {
            where: {
              id: messagesToUpdate.map((msg) => msg.id),
            },
          }
        );

        const recipientSocketId = getRecipientSocketId(userId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("messagesSeen", { conversationId });
        }
      }
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("markNotificationsAsSeen", async ({ userId }) => {
    try {
      await Notification.update(
        { seen: true },
        {
          where: {
            recipient_id: userId,
            seen: false,
          },
        }
      );
      const recipientSocketId = getRecipientSocketId(userId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("NotificationsSeen", { userId });
      }
    } catch (error) {
      console.log("Error marking notifications as seen:", error);
    }
  });

  /**
   * NEW: postViewed event
   * Payload expected: { postId, actorId, actorUsername?, mainField? }
   *
   * For each follower of the actor we push an interaction event into that follower's
   * cache list key `interactions:<followerId>`. TTL is reset to 24h on set.
   *
   * We cap each follower list to INTERACTION_CAP items (most recent).
   */
  socket.on("postViewed", async (payload) => {
    try {
      if (!payload || !payload.postId || !payload.actorId) {
        // missing essential info
        socket.emit("postViewedAck", { success: false, reason: "missing postId or actorId" });
        return;
      }

      // fetch actor and post snapshots
      const actor = await User.findByPk(payload.actorId, { attributes: ["id", "username"] });
      const post = await Post.findByPk(payload.postId, { attributes: ["id", "mainField", "type"] });

      if (!actor || !post) {
        socket.emit("postViewedAck", { success: false, reason: "actor or post not found" });
        return;
      }

      // load followers via Sequelize association 'Followers' (as defined in your models)
      // Note: Your association exists in userModel: User.belongsToMany(User, { through: Follower, as: 'Followers', ... })
      // so actor.getFollowers() should work.
      const followers = typeof actor.getFollowers === "function"
        ? await actor.getFollowers({ attributes: ["id", "username"] })
        : [];

      // if many followers, do a safe cap to avoid huge synchronous work
      // (production: consider background job / Redis pipeline).
      const MAX_FANOUT = 5000;
      if (followers.length > MAX_FANOUT) {
        console.warn(`actor ${actor.id} has ${followers.length} followers; skipping heavy fanout. Consider async pipeline.`);
        // Optionally: you could still process first 5000, but skip for now to protect process.
      }

      for (const f of followers) {
        try {
          const key = `interactions:${f.id}`;
          const existing = interactionCache.get(key) || [];

          existing.push({
            actorId: actor.id,
            actorUsername: actor.username || payload.actorUsername || null,
            postId: post.id,
            mainField: post.mainField || payload.mainField || post.type || "",
            timestamp: Date.now(),
          });

          // cap length to last INTERACTION_CAP elements (most recent)
          if (existing.length > INTERACTION_CAP) {
            // keep last INTERACTION_CAP entries
            existing.splice(0, existing.length - INTERACTION_CAP);
          }

          interactionCache.set(key, existing, INTERACTION_TTL);

          // log
          try {
            // show last 5 events and counts
            const lastEvents = existing.slice(-5);
            const perTaxCounts = {};
            for (const ev of existing) {
              const mf = ev.mainField || ev.type || "";
              perTaxCounts[mf] = (perTaxCounts[mf] || 0) + 1;
            }
            console.log(`\n\n[interactionCache] follower=${f.id} key=${key} totalEvents=${existing.length} recent=${JSON.stringify(lastEvents)} perTaxCounts=${JSON.stringify(perTaxCounts)}`);
          } catch (logErr) {
            console.warn("Failed to log interactionCache summary:", logErr);
          }

        } catch (innerErr) {
          // keep going for other followers even if one fails
          console.warn("Failed to write interaction cache for follower", f.id, innerErr);
        }
      }

      socket.emit("postViewedAck", { success: true });
    } catch (err) {
      console.warn("postViewed handler failed", err);
      socket.emit("postViewedAck", { success: false, reason: err.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, server, app };
