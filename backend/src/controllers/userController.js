import bcrypt from "bcryptjs";
import {generateTokenAndSetCookie} from "../utils/generateTokenAndSetCookie.js";
import { v2 as cloudinary } from "cloudinary";
import { User, Follower } from "../models/userModel.js";
import { Post, Reply, ReplyUser, UserPost } from "../models/postModel.js";
import { Op, Sequelize } from "sequelize";
import { sequelize } from "../config/database.js";
import { AnalyzeUserTrendingForUserRecommendation } from "../gemini/useAI2.js";

export const UserSignup = async (req, res) => {
    try {
        const { name, email, username, password } = req.body;
        
        if (!name || !email || !username || !password ) {
            return res.status(400).json({ error: "Please enter all required fields" });
        }

        const user = await User.findOne({ where: { [Op.or]: [{ email }, { username }] } });
        if (user && user.email === email) {
            return res.status(400).json({ error: "Email already exists" });
        } else if (user && user.username === username){
            return res.status(400).json({ error: "User Name already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name,
            email,
            username,
            password: hash,
        });

        if (newUser) {
            const token = generateTokenAndSetCookie({ id: newUser.id, username: newUser.username }, res);

            return res.status(201).json({
                name: newUser.name,
                username: newUser.username,
                email: newUser.email,
                id: newUser.id,
                bio: newUser.bio,
                profilePic: newUser.profilePic,
                position: newUser.position,
                is_global_admin: newUser.is_global_admin,
                token,
            });
        } else {
            return res.status(400).json({ error: "Invalid user data" });
        }
    } catch (error) {
        console.error("Error in User signup", error.message);
        return res.status(500).json({ error: error.message });
    }
};


export const UserSigInWithGitHub = async (req, res) => {
    try {
        const { name, email, username, password, profilePic } = req.body;
        
        if (!name || !email || !username || !password || !profilePic) {
            return res.status(400).json({ error: "Please enter all required fields" });
        }

        const user = await User.findOne({ where: { email }});
        if(user){
            const token = generateTokenAndSetCookie({ id: user.id, username: user.username }, res);


            return res.status(200).json({
                name: user.name,
                username: user.username,
                email: user.email,
                id: user.id,
                bio: user.bio,
                profilePic: user.profilePic,
                position: user.position,
                is_global_admin: user.is_global_admin,
                token,
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name,
            email,
            username,
            password: hash,
            profilePic
        });

        if (newUser) {
            const token = generateTokenAndSetCookie({ id: newUser.id, username: newUser.username }, res);

            return res.status(201).json({
                name: newUser.name,
                username: newUser.username,
                email: newUser.email,
                id: newUser.id,
                bio: newUser.bio,
                profilePic: newUser.profilePic,
                position: newUser.position,
                is_global_admin: user.is_global_admin,
                token,
            });
        } else {
            return res.status(400).json({ error: "Invalid user data" });
        }
    } catch (error) {
        console.error("Error in User Sign In With GitHub", error.message);
        return res.status(500).json({ error: error.message });
    }
};


export const UserSigInWithGoogle = async (req, res) => {
  try {
    let { name, email, username, password, profilePic, code, redirectUri } = req.body;

    // If an authorization code is provided, exchange it for an access token
    if (code) {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.VITE_GG_CLIENT_ID,
          client_secret: process.env.VITE_GG_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        return res
          .status(400)
          .json({ error: tokenData.error_description || 'Token exchange failed' });
      }
      const accessToken = tokenData.access_token;

      // Retrieve user information from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userInfo = await userInfoResponse.json();

      // Map the Google user info to your required fields
      name = userInfo.name;
      email = userInfo.email;
      username = userInfo.given_name; // or any other logic to derive a username
      password = String(userInfo.id); // using the Google id as a surrogate
      profilePic = userInfo.picture;
    }

    if (!name || !email || !username || !password || !profilePic) {
      return res.status(400).json({ error: "Please enter all required fields" });
    }

    // Check if user already exists
    const user = await User.findOne({ where: { email } });
    if (user) {
      const token = generateTokenAndSetCookie({ id: user.id, username: user.username }, res);
      return res.status(200).json({
        name: user.name,
        username: user.username,
        email: user.email,
        id: user.id,
        bio: user.bio,
        profilePic: user.profilePic,
        position: user.position,
        is_global_admin: user.is_global_admin,
        token,
      });
    }

    // Register new user
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const newUser = await User.create({
      name,
      email,
      username,
      password: hash,
      profilePic
    });

    if (newUser) {
      const token = generateTokenAndSetCookie({ id: newUser.id, username: newUser.username }, res);
      return res.status(201).json({
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        id: newUser.id,
        bio: newUser.bio,
        profilePic: newUser.profilePic,
        position: newUser.position,
        is_global_admin: newUser.is_global_admin,
        token,
      });
    } else {
      return res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    console.error("Error in User Sign In With Google", error.message);
    return res.status(500).json({ error: error.message });
  }
};


export const UserLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: "Invalid Email" });
        }

        const isCorrectPassword = await bcrypt.compare(password, user.password);
        if (!isCorrectPassword) {
            return res.status(400).json({ error: "Invalid password" });
        }

        if (user.isFrozen) {
            user.isFrozen = false;
            await user.save();
        }

        const token = generateTokenAndSetCookie({ id: user.id, username: user.username }, res);


        return res.status(200).json({
            name: user.name,
            username: user.username,
            email: user.email,
            id: user.id,
            bio: user.bio,
            profilePic: user.profilePic,
            position: user.position,
            is_global_admin: user.is_global_admin,
            token,
        });
    } catch (error) {
        console.error("Error in User login", error.message);
        return res.status(500).json({ error: error.message });
    }
};

export const UserLogout = async (req, res) => {
    try {
        res.cookie("jwt-social", "", { maxAge: 1 });
        return res.status(200).json({ message: "User logged out successfully" });
    } catch (error) {
        console.error("Error in User logout", error.message);
        return res.status(500).json({ error: error.message });
    }
};

export const FollowAndUnFollowUser = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUser = await User.findByPk(req.user.id);
        const userToModify = await User.findByPk(id);

        if (id === currentUser.id.toString()) {
            return res.status(400).json({ error: "You cannot follow or unfollow yourself" });
        }

        if (!userToModify || !currentUser) {
            return res.status(400).json({ error: "User not found" });
        }

        // Check if the current user is already following the user to modify
        const isFollowing = await Follower.findOne({
            where: {
                follower_id: currentUser.id,
                following_id: userToModify.id
            }
        });

        if (isFollowing) {
            await Follower.destroy({
                where: {
                    follower_id: currentUser.id,
                    following_id: userToModify.id
                }
            });
            return res.status(200).json({ message: "User unfollowed successfully" });
        } else {
            await Follower.create({
                follower_id: currentUser.id,
                following_id: userToModify.id
            });
            return res.status(200).json({ message: "User followed successfully" });
        }
    } catch (error) {
        console.error("Error in Follow And UnFollow", error.message);
        return res.status(500).json({ error: error.message });
    }
};

export const updateUser = async (req, res) => {
    const { name, email, username, password, bio, position } = req.body;
    let { profilePic } = req.body;

    const userId = req.user.id;
    try {
        const user = await User.findByPk(userId);
        if (!user) return res.status(400).json({ error: "User not found" });

        if (req.params.id !== userId.toString()) {
            return res.status(400).json({ error: "You cannot update other user's profile" });
        }

        if (password) { // check if password is not null
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            user.password = hashedPassword;
        }

        if (profilePic) {
            if (user.profilePic) {
                await cloudinary.uploader.destroy(user.profilePic.split("/").pop().split(".")[0]);
            }
            const uploadedResponse = await cloudinary.uploader.upload(profilePic);
            profilePic = uploadedResponse.secure_url;
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.username = username || user.username;
        user.profilePic = profilePic || user.profilePic;
        user.bio = bio || user.bio;
        user.position = position || user.position;

        await user.save();

        // Get all related replies for this user
        const userReplies = await ReplyUser.findAll({
            where: { user_id: userId },
            attributes: ["reply_id"],
        });

        const replyIds = userReplies.map((reply) => reply.reply_id);

        if (replyIds.length > 0) {
            // Update Replies table with new username and profilePic
            await Reply.update(
                { username: user.username, userProfilePic: user.profilePic },
                { where: { id: replyIds } }
            );
        }

        user.password = null; // Remove password from response

        return res.status(200).json(user);
    } catch (error) {
        console.error("Error in Update User", error.message);
        return res.status(500).json({ error: error.message });
    }
};

export const getUserProfile = async (req, res) => {
    const { query } = req.params;

    try {
        let user;
        if (Number.isInteger(Number(query))) {
            user = await User.findByPk(query);
        } else {
            user = await User.findOne({ where: { username: query } });
        }

        if (!user) return res.status(400).json({ error: "User not found" });

        // Count the number of posts by the user
        const postCount = await UserPost.count({ where: { user_id: user.id } });

        // Count the number of followers
        const followerCount = await Follower.count({ where: { following_id: user.id } });

        // Count the number of people the user is following
        const followingCount = await Follower.count({ where: { follower_id: user.id } });

        // Destructure to remove the password field
        const { password, ...userWithoutPassword } = user.dataValues;

        return res.status(200).json({
            ...userWithoutPassword,
            postCount,
            followerCount,
            followingCount
        });
    } catch (error) {
        console.error("Error in Get User Profile", error.message);
        return res.status(500).json({ error: error.message });
    }
};


// controllers/userController.js
import NodeCache from "node-cache";
const aiCache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // cache 24h

export const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    // Retrieve current user along with their "Following" association
    const user = await User.findByPk(userId, {
      include: {
        model: User,
        as: 'Following',
        attributes: ['id'],
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Retrieve posts owned by the user for analysis
    const userPosts = await Post.findAndCountAll({
      include: [
        {
          model: User,
          as: "Owners",
          attributes: ["id", "username", "profilePic"],
          through: { attributes: [] },
          where: { id: user.id },
        },
        {
          model: User,
          as: "LikedByUsers",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
      attributes: {
        include: [
          [sequelize.literal(`(
            SELECT COUNT(*)
            FROM postlikes AS pl
            WHERE pl.post_id = Post.id
          )`), 'TotalLikeNumber'],
          [sequelize.literal(`(
            SELECT COUNT(*)
            FROM repliesuser AS ru
            JOIN postreplies AS pr ON ru.reply_id = pr.reply_id
            WHERE pr.post_id = Post.id
          )`), 'TotalRepliesNumber']
        ]
      },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ],
      limit: 5,
    });

    const formattedPosts = userPosts.rows.map(p => {
      const postData = p.toJSON();
      return {
        ...postData,
        postedBy: postData.Owners && postData.Owners[0] ? postData.Owners[0].id : null,
        UserName: postData.Owners && postData.Owners[0] ? postData.Owners[0].username : null,
        profilePic: postData.Owners && postData.Owners[0] ? postData.Owners[0].profilePic : null,
        likedByUserIds: postData.LikedByUsers ? postData.LikedByUsers.map(u => u.id) : [],
      };
    });

    // Analyze the user's trending field using AI (safe)
    const cacheKey = `predictTrending:${userId}`;
    let PredictUserTrending = aiCache.get(cacheKey) || "";

    const taxonomyList = [
      "Core Infrastructure & Operations",
      "Software & Application Development",
      "Data Engineering & Management",
		  "Artificial Intelligence & Analytics",
      "Security & Operations Management",
      "Emerging Technologies"
    ];

    if (!PredictUserTrending) {
      try {
        const aiResult = await AnalyzeUserTrendingForUserRecommendation(user, formattedPosts, { timeoutMs: 3500 });
        if (aiResult && typeof aiResult === 'string') {
          const trimmed = aiResult.trim();
          if (taxonomyList.includes(trimmed)) {
            PredictUserTrending = trimmed;
            aiCache.set(cacheKey, PredictUserTrending);
          } else {
            PredictUserTrending = "";
          }
        }
      } catch (err) {
        console.warn("AI call failed for suggested users; continuing without AI:", err.message);
        PredictUserTrending = "";
      }
    }

    // Build suggestions from following relationships
    const followingIds = user.Following.map(f => f.id);
    let suggestions = [];

    if (followingIds.length === 0) {
      // Case 1: If the user is not following anyone, get random users (excluding myself)
      suggestions = await User.findAll({
        where: {
          id: { [Op.ne]: userId },
          isFrozen: false,
        },
        limit: 10,
        order: Sequelize.literal('RAND()'),
      });
    } else {
      // Case 2: BFS-like from followed user's following
      for (const followedUserId of followingIds) {
        const followedUser = await User.findByPk(followedUserId, {
          include: {
            model: User,
            as: 'Following',
            attributes: [
              'id', 'name', 'username', 'email',
              'profilePic', 'bio', 'position', 'isFrozen'
            ],
          },
        });
        if (followedUser && followedUser.Following) {
          followedUser.Following.forEach(follower => {
            if (
              follower.id !== userId &&
              !followingIds.includes(follower.id) &&
              !follower.isFrozen &&
              !suggestions.some(s => s.id === follower.id)
            ) {
              suggestions.push(follower);
            }
          });
        }
      }
    }

    // If AI predicted a taxonomy, add recommended users (up to 2)
    if (PredictUserTrending) {
      try {
        const recommendedUsers = await User.findAll({
          where: {
            isFrozen: false,
          },
          include: [{
            model: Post,
            as: 'OwnedPosts',
            through: { attributes: [] },
            attributes: [],
            where: { mainField: PredictUserTrending }
          }],
          attributes: {
            include: [
              [sequelize.literal(`(
                SELECT COUNT(*) 
                FROM userposts AS up 
                INNER JOIN posts AS p ON p.id = up.post_id 
                WHERE up.user_id = User.id 
                  AND p.mainField = '${PredictUserTrending}'
              )`), 'postCount']
            ]
          },
          group: ['User.id'],
          order: [[sequelize.literal('postCount'), 'DESC']],
        });

        const filteredRecommended = recommendedUsers.filter(u => {
          return u.id !== userId &&
                !followingIds.map(String).includes(String(u.id)) && 
                // Use String() to ensure strict equality doesn't fail
                !suggestions.some(s => String(s.id) === String(u.id));
        });

        filteredRecommended.slice(0, 2).forEach(u => {
          const userData = { ...u.toJSON(), recommend: true };
          suggestions.push(userData);
        });
      } catch (recErr) {
        console.warn("Failed to fetch recommended users by taxonomy; continuing:", recErr.message);
      }
    }

    // Fill up to 10
    if (suggestions.length < 10) {
      const excludeIds = new Set([userId, ...followingIds, ...suggestions.map(s => s.id)]);
      const additionalUsers = await User.findAll({
        where: {
          id: { [Op.notIn]: Array.from(excludeIds) },
          isFrozen: false,
        },
        limit: 10 - suggestions.length,
        order: Sequelize.literal('RAND()'),
      });
      suggestions = suggestions.concat(additionalUsers);
    }

    const uniqueMap = new Map();

    suggestions.sort((a, b) => (a.recommend === b.recommend ? 0 : a.recommend ? 1 : -1));

    suggestions.forEach(user => {
      const data = user.toJSON ? user.toJSON() : user;
      uniqueMap.set(String(data.id), data);
    });

    // Convert Map back to Array
    const dedupedSuggestions = Array.from(uniqueMap.values());

    // Separate and limit
    const recommended = dedupedSuggestions.filter(s => s.recommend === true);
    const nonRecommended = dedupedSuggestions.filter(s => s.recommend !== true);

    const totalCount = 5;
    const nonRecLimit = Math.max(totalCount - recommended.length, 0);

    // Combine: Recommended users first (or last, based on your UI preference)
    const finalSuggestions = recommended.concat(nonRecommended).slice(0, totalCount);

    return res.status(200).json(finalSuggestions);
  } catch (error) {
    console.error("Error in Get Suggested Users", error.message);
    return res.status(500).json({ error: error.message });
  }
};

  

export const getFollowingId = async (req, res) => {
    try {
        const userId = req.user.id;

        // Retrieve the user along with their "Following" association
        const user = await User.findByPk(userId, {
            include: {
                model: User,
                as: 'Following',
                attributes: ['id'], 
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Extract IDs of users the current user is following
        const followingIds = user.Following.map(f => f.id);

        
        return res.status(200).json(followingIds);
    } catch (error) {
        console.error("Error in Get Suggested Users", error.message);
        return res.status(500).json({ error: error.message });
    }
};


export const freezeAccount = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        user.isFrozen = true;
        await user.save();

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error in Freeze User Account", error.message);
        return res.status(500).json({ error: error.message });
    }
};

export const FilterFollowingUser = async (req, res) => {
    try {
      const userId = req.user.id;
      // Parse pagination parameters from query
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 3;
      const offset = (page - 1) * limit;
  
      // Retrieve the user without the association included initially
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Get total count of following users
      const totalFollowing = await user.countFollowing();
  
      // Get paginated list of following users using association method
      const followingUsers = await user.getFollowing({
        attributes: ['id', 'username', 'profilePic', 'position', 'bio'],
        limit,
        offset,
      });
  
      const result = followingUsers.map((listUser) => ({
        name: listUser.username,
        profilePic: listUser.profilePic,
        id: listUser.id,
        position: listUser.position,
        bio: listUser.bio || "",
      }));
  
      const totalPages = Math.ceil(totalFollowing / limit);
  
      return res.status(200).json({
        users: result,
        totalUsers: totalFollowing,
        currentPage: page,
        totalPages,
      });
    } catch (error) {
      console.error("Error in Get Following Users", error.message);
      return res.status(500).json({ error: error.message });
    }
};

export const SearchUserToMakeConversation = async (req, res) => {
  try {
      const { Term } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = 3;
      const offset = (page - 1) * limit;

      // Use findAndCountAll to get paginated results and total count
      const { count, rows } = await User.findAndCountAll({
          where: {
              username: {
                  [Op.iLike]: `%${Term}%` 
              }
          },
          limit,
          offset,
          attributes: ['id', 'username', 'profilePic', 'position', 'bio']
      });

      if (rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      }

      const searchResults = rows.map(listUser => ({
          name: listUser.username,
          profilePic: listUser.profilePic,
          id: listUser.id,
          position: listUser.position,
          bio: listUser.bio || ""
      }));

      const totalPages = Math.ceil(count / limit);

      return res.status(200).json({
          searchResults,
          totalUsers: count,
          currentPage: page,
          totalPages
      });
  } catch (error) {
      console.error("Error in SearchUserToMakeConversation", error.message);
      return res.status(500).json({ error: error.message });
  }
};

export const SearchUsers = async (req, res) => {
    try {
        const { Term } = req.params;
        const page = parseInt(req.query.page) || 0;
        const limit = 4; // users per page
        const offset = page * limit;

        const users = await User.findAll({
            where: {
                username: {
                    [Op.like]: `%${Term}%`
                }
            },
            limit,
            offset
        });

        const results = users.map(user => ({
            id: user.id,
            name: user.name,
            username: user.username,
            profilePicture: user.profilePicture,
            bio: user.bio,
            position: user.position
        }));

        return res.status(200).json(results);
    } catch (error) {
        console.error("Error in Get Searched Users", error.message);
        return res.status(500).json({ error: error.message });
    }
};


export const getLikedUsersByIds = async (req, res) => {
  try {
    const ids = req.body?.ids;
    // 1-based page (consistent with your other endpoints)
    const pageParam = parseInt(req.query.page, 10);
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    console.log("[getLikedUsersByIds] incoming", { idsLength: Array.isArray(ids) ? ids.length : 0, page, limit, offset });

    if (!Array.isArray(ids) || ids.length === 0) {
      console.log("[getLikedUsersByIds] missing ids");
      return res.status(400).json({ error: "ids array is required in request body" });
    }

    // Single DB call to fetch matching users
    const dbUsers = await User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "name", "username", "profilePic", "bio", "position"],
    });

    const userMap = new Map();
    dbUsers.forEach(u => userMap.set(Number(u.id), u));

    // preserve the order of ids param, drop missing ones
    const ordered = ids.map(id => userMap.get(Number(id))).filter(Boolean);

    const total = ordered.length;
    const paged = ordered.slice(offset, offset + limit);
    const hasMore = offset + paged.length < total;

    console.log("[getLikedUsersByIds] returning", { page, returned: paged.length, hasMore, total });

    return res.status(200).json({ users: paged, hasMore, total });
  } catch (error) {
    console.error("[getLikedUsersByIds] error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};




