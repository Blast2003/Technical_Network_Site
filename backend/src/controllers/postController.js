import {Post, PostLike, PostReply, Reply, ReplyUser, UserPost} from "../models/postModel.js";
import {User} from "../models/userModel.js";
import { v2 as cloudinary } from "cloudinary";
import { sequelize } from "../config/database.js";
import { Op } from "sequelize";
import { Notification } from "../models/notificationModel.js";
import { getRecipientSocketId, io } from "../socket/socket.js";
import {analyzePost, Taxonomy} from "../gemini/useAI1.js";
import sanitizeTaxonomy from "../utils/sanitizeTaxonomy.js"
import { AnalyzeUserTrendingPostRecommendation } from "../gemini/useAI3.js";

// Create a new post
export const createPost = async (req, res) => {
	const transaction = await sequelize.transaction(); // ensure atomicity
	try {
	  const { postedBy, text, title, type, hashtag } = req.body;
	  let {sourceType} = req.body;
	  let { img } = req.body;
  
	  if (!postedBy || !text || !title || !type || !hashtag) {
		return res.status(400).json({ error: "All fields are required" });
	  }

	  // check recruitment and source types are matching or not?
	  if(type !== "Recruitment" && sourceType !== ""){
		return res.status(400).json({error: "Knowledge post does not contain source type"});
	  }

	  // check post is related to IT or not
	  const analyzeObject = await analyzePost(title, text, hashtag);
	  
	//   console.log(analyzeObject)

	  if(analyzeObject){
		if(!analyzeObject.topic){
			return res.status(400).json({topicError: "Invalid Topic!"})
		  }
	
		  if(!analyzeObject.content){
			return res.status(400).json({contentError: "Your content is not relevant to the topic!"})
		  }
	
		  if(!analyzeObject.hashtag){
			return res.status(400).json({hashtagError: "Your hashtag is not relevant to the topic!"})
		  }
	  }

	  const allowedTaxonomies = [
		"Core Infrastructure & Operations",
		"Software & Application Development",
		"Data & Intelligence",
		"Security & Operations Management",
		"Emerging Technologies"
	  ];
	  

	  // Taxonomy post title
	  let newTitle = await Taxonomy(title);
	  const rawMainField = newTitle.trim();
	  let mainField = sanitizeTaxonomy(rawMainField);

	  if(!mainField || mainField ===""){
		return res.status(400).json({error: "Have the problem with AI to distinguish Taxonomy"})
	  }

	  if (!allowedTaxonomies.includes(mainField)) {
		// allowed taxonomy is a substring of the mainField
		const matched = allowedTaxonomies.find(tax => mainField.includes(tax));
		if (matched) {
		  mainField = matched;
		} else {
		  mainField = '';
		  return res.status(400).json({error: `Taxonomy returned does not match allowed values:${mainField}`})
		}
	  }

  
	  const user = await User.findByPk(postedBy, { transaction });
	  if (!user) return res.status(404).json({ error: "User not found" });
  
	  if (user.id !== req.user.id) {
		return res.status(401).json({ error: "Unauthorized to create post" });
	  }
  
	  const maxLength = 500;
	  if (text.length > maxLength) {
		return res.status(400).json({ error: `Text must be less than ${maxLength} characters` });
	  }
  
	  if (img) {
		const uploadedResponse = await cloudinary.uploader.upload(img);
		img = uploadedResponse.secure_url;
	  }
  
	  // Create new post record
	  const newPost = await Post.create(
		{ text, img, title, type, hashtag, mainField, sourceType },
		{ transaction }
	  );
  
	  // Create record in UserPost (ownership) table
	  await UserPost.create(
		{ user_id: user.id, post_id: newPost.id },
		{ transaction }
	  );
  
	  const followers = await user.getFollowers({
		attributes: ["id", "username", "profilePic"],
	  });
	  const followerIds = followers.map(follower => follower.id);
  
	  let notifications = [];
	  // Create a notification for each follower individually so we can include associations
	  if (followerIds.length > 0) {
		notifications = await Promise.all(
		  followerIds.map(async (followerId) => {
			let notification = await Notification.create(
			  {
				sender_id: user.id,
				recipient_id: followerId,
				post_id: newPost.id,
				action: "The person you're following has made a new post",
				seen: false,
				createdAt: new Date(),
			  },
			  { transaction }
			);
			// Immediately load associated Sender and Recipient
			await notification.reload({
			  transaction,
			  include: [
				{ model: User, as: 'Sender', attributes: { exclude: ['password'] } },
				{ model: User, as: 'Recipient', attributes: { exclude: ['password'] } },
			  ],
			});
  
			// Emit WebSocket event to the recipient of this notification
			const recipientSocketId = getRecipientSocketId(notification.recipient_id);
			if (recipientSocketId) {
			  io.to(recipientSocketId).emit("newNotification", notification);
			}
			return notification;
		  })
		);
	  }
  
	  await transaction.commit();
	  return res.status(201).json({
		postedBy,
		profilePic: user.profilePic,
		...newPost.toJSON(),
		notifications,
	  });
	} catch (error) {
	  await transaction.rollback();
	  console.error("Error in Create Post:", error.message);
	  return res.status(500).json({ error: error.message });
	}
};  
  
// Get a specific post
export const getPost = async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'Owners',  // Users who own the post
                    attributes: ['id', 'username', 'profilePic'],
                    through: { attributes: [] },
                },
                {
                    model: User,
                    as: 'LikedByUsers',  // Users who liked the post
                    attributes: ['id'],
                    through: { attributes: [] },
                }
            ],
            attributes: {
                include: [
                    [sequelize.literal(`(SELECT COUNT(*) FROM postlikes WHERE postlikes.post_id = Post.id)`), "TotalLikeNumber"],
                    [sequelize.literal(`(SELECT COUNT(*) FROM postreplies WHERE postreplies.post_id = Post.id)`), "TotalRepliesNumber"],
                ],
            },
        });

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        const firstOwner = post.Owners?.[0] || null;
        const LikedUserIds = post.LikedByUsers?.map((user) => user.id) || [];



        const response = {
            ...post.toJSON(),
            postedBy: firstOwner ? firstOwner.id : null,
            UserName: firstOwner ? firstOwner.username : null, 
            profilePic: firstOwner ? firstOwner.profilePic : "", 
			LikeCount: LikedUserIds.length,
            LikedUserIds,
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Error in getPost:", error.message);
        res.status(500).json({ error: error.message });
    }
};
  
// Delete a post
export const deletePost = async (req, res) => {
	const { postId } = req.params;
	const transaction = await sequelize.transaction();
	try {
	  const post = await Post.findByPk(postId, { transaction });
	  if (!post) return res.status(400).json({ error: "Post not found" });
  
	  const userPost = await UserPost.findOne({
		where: { post_id: postId, user_id: req.user.id },
		transaction,
	  });
	  if (!userPost) {
		return res.status(400).json({ error: "Unauthorized to delete post" });
	  }
  
	  // CASE 1: Delete notifications for the new post event
	  const notifications = await Notification.findAll({
		where: {
		  post_id: postId,
		  action: "The person you're following has made a new post",
		},
		transaction,
	  });
  
	  for (let notification of notifications) {
		// Reload notification with associated Sender and Recipient
		await notification.reload({
		  transaction,
		  include: [
			{ model: User, as: "Sender", attributes: { exclude: ["password"] } },
			{ model: User, as: "Recipient", attributes: { exclude: ["password"] } },
		  ],
		});
		// Get recipient's socket ID and emit websocket event with the notification object
		const recipientSocketId = getRecipientSocketId(notification.recipient_id);
		if (recipientSocketId) {
		  io.to(recipientSocketId).emit("notificationDeleted", notification);
		}
		// Delete the notification record
		await notification.destroy({ transaction });
	  }
  
	  // Optionally, remove image if it exists.
	  if (post.img) {
		const imgId = post.img.split("/").pop().split(".")[0];
		await cloudinary.uploader.destroy(imgId);
	  }
  
	  await post.destroy({ transaction });
	  await transaction.commit();
	  return res
		.status(200)
		.json({ message: "Post deleted successfully", deletedPost: post });
	} catch (error) {
	  await transaction.rollback();
	  console.error("Error in Delete Post:", error.message);
	  return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
	}
};
  

// Like or Unlike a Post
export const likeUnlikePost = async (req, res) => {
	try {
	  const { id } = req.params;
	  const userId = req.user.id;
  
	  // Check if the post exists
	  const post = await Post.findByPk(id);
	  if (!post) {
		return res.status(404).json({ error: "Post not found" });
	  }
  
	  // Retrieve the owner(s) of the post via the defined association.
	  const owners = await post.getOwners({ attributes: ["id", "isFrozen"] });

	  if(owners && owners.length > 0 && owners[0].isFrozen){
		return res.status(400).json({error: "Can not interact! This post has been frozen!"})
	  }
	
	  const ownerId = owners.length > 0 ? owners[0].id : null;
  
	  // Check if the user already liked the post
	  const existingLike = await PostLike.findOne({
		where: { post_id: id, user_id: userId },
	  });
  
	  if (existingLike) {
		// Remove the like if it exists
		await existingLike.destroy();
  
		// CASE 2: Delete like notification if it exists and sender is not the owner.
		if (ownerId && ownerId !== userId) {
		  const notification = await Notification.findOne({
			where: {
			  sender_id: userId,
			  recipient_id: ownerId,
			  post_id: id,
			  action: "A user liked your post",
			},
		  });
		  if (notification) {
			await notification.reload({
			  include: [
				{ model: User, as: "Sender", attributes: { exclude: ["password"] } },
				{ model: User, as: "Recipient", attributes: { exclude: ["password"] } },
			  ],
			});
			const recipientSocketId = getRecipientSocketId(notification.recipient_id);
			if (recipientSocketId) {
			  io.to(recipientSocketId).emit("notificationDeleted", notification);
			}
			await notification.destroy();
		  }
		}

		// recalc total likes
		const totalLikes = await PostLike.count({ where: { post_id: id } });
		// console.log("Total Like count after unlike: ", totalLikes)
		// broadcast to room
		io.to(`post_${id}`).emit("postLikeUpdated", {
		  postId: +id,
		  isLiked: false,
		  totalLikes,
		});

		return res.status(200).json({ message: "Post unliked successfully", isLiked: false });
	  } else {
		// Create the like if it doesn't exist.
		await PostLike.create({ post_id: id, user_id: userId });

		const totalLikes = await PostLike.count({ where: { post_id: id } });
		console.log("Total Like count after like: ", totalLikes)
  
		let notification;
		// If the post owner is not the user liking the post, create a notification.
		if (ownerId && ownerId !== userId) {
		  notification = await Notification.create({
			sender_id: userId,
			recipient_id: ownerId,
			post_id: id,
			action: "A user liked your post",
			seen: false,
		  });
		  await notification.reload({
			include: [
			  { model: User, as: "Sender", attributes: { exclude: ["password"] } },
			  { model: User, as: "Recipient", attributes: { exclude: ["password"] } },
			],
		  });
  
		  const recipientSocketId = getRecipientSocketId(notification.recipient_id);
		  if (recipientSocketId) {
			io.to(recipientSocketId).emit("newNotification", notification);
		  }
		}

		// broadcast to room
		io.to(`post_${id}`).emit("postLikeUpdated", {
			postId: +id,
			isLiked: true,
			totalLikes,
		  });
		  
		return res
		  .status(200)
		  .json({ message: "Post liked successfully", isLiked: true, notification });
	  }
	} catch (error) {
	  console.error("Error in likeUnlikePost:", error.message);
	  return res.status(500).json({ error: error.message });
	}
};
    
  
// Create Reply to a Post
export const replyToPost = async (req, res) => {
	const transaction = await sequelize.transaction();
	const userId = req.user.id;
	try {
	  const { text } = req.body;
	  const postId = req.params.id;
  
	  if (!text) {
		return res.status(400).json({ error: "Text field is required" });
	  }
  
	  const post = await Post.findByPk(postId, { transaction });
	  if (!post) {
		return res.status(404).json({ error: "Post not found" });
	  }

	  // Retrieve the owner(s) of the post via the Owners association
	  const owners = await post.getOwners({ attributes: ['id', 'isFrozen'] });

	  if(owners && owners.length > 0 && owners[0].isFrozen){
		return res.status(400).json({error: "Can not interact! This post has been frozen!"})
	  }


	  const ownerId = (owners && owners.length > 0) ? owners[0].id : null;
  
	  // Create the reply
	  const reply = await Reply.create({
		text,
		username: req.user.username || null,
		userProfilePic: req.user.profilePic || null,
	  }, { transaction });
  
	  // Associate the reply with the post
	  await PostReply.create({
		post_id: parseInt(postId, 10),
		reply_id: reply.id,
	  }, { transaction });
  
	  // Associate the reply with the user who replied
	  await ReplyUser.create({
		user_id: userId,
		reply_id: reply.id,
	  }, { transaction });
  
  
	  let notification;
	  // Create a notification if the replier is not the post owner
	  if (ownerId && ownerId !== userId) {
		notification = await Notification.create({
		  sender_id: userId,
		  recipient_id: ownerId,
		  post_id: postId,
		  action: "A user replied on your post",
		  seen: false,
		}, { transaction });
		// Reload within the transaction to include associations
		await notification.reload({
		  transaction,
		  include: [
			{ model: User, as: 'Sender', attributes: { exclude: ['password'] } },
			{ model: User, as: 'Recipient', attributes: { exclude: ['password'] } },
		  ],
		});
  
		// Emit WebSocket event to the recipient of this notification
		const recipientSocketId = getRecipientSocketId(notification.recipient_id);
		if (recipientSocketId) {
		  io.to(recipientSocketId).emit("newNotification", notification);
		}
	  }

	  	await transaction.commit();

	  	// 1) recompute
		const totalReplies = await PostReply.count({ where: { post_id: postId } });

		console.log("Total Replies Server: ", totalReplies)

		// 2) broadcast
		io.to(`post_${postId}`).emit("postReplyUpdated", {
		postId: parseInt(postId, 10),
		totalReplies,
		action: "added"
		});
  
	  res.status(201).json({
		message: "Reply added successfully",
		reply,
		notification,
	  });
	} catch (error) {
	  await transaction.rollback();
	  console.error("Error in replyToPost:", error.message);
	  res.status(500).json({ error: error.message });
	}
};
  
  
// Get feed posts
export const getFeedPosts = async (req, res) => {
	try {
	  const userId = req.user.id;
	  const term = "Knowledge";
  
	  // Find the current user
	  const user = await User.findByPk(userId);
	  if (!user) {
		return res.status(404).json({ error: "User not found" });
	  }
  
	  // Retrieve posts owned by the user (for trending analysis)
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
			[
			  sequelize.literal(`(
				SELECT COUNT(*)
				FROM postlikes AS pl
				WHERE pl.post_id = Post.id
			  )`),
			  'TotalLikeNumber'
			],
			[
			  sequelize.literal(`(
				SELECT COUNT(*)
				FROM postreplies AS pr
				WHERE pr.post_id = Post.id
			  )`),
			  'TotalRepliesNumber'
			]
		  ]
		},
		order: [
		  ['createdAt', 'DESC'],
		  ['id', 'DESC']
		],
		limit: 5,
	  });
  
	  // Format posts for analysis
	  const trueUserPosts = userPosts.rows.map(p => {
		const postData = p.toJSON();
		return {
		  ...postData,
		  postedBy: postData.Owners && postData.Owners[0] ? postData.Owners[0].id : null,
		  UserName: postData.Owners && postData.Owners[0] ? postData.Owners[0].username : null,
		  profilePic: postData.Owners && postData.Owners[0] ? postData.Owners[0].profilePic : null,
		  likedByUserIds: postData.LikedByUsers ? postData.LikedByUsers.map(u => u.id) : [],
		};
	  });
  
	  // Analyze the user's trending field using AI
	  let PredictUserTrending = await AnalyzeUserTrendingPostRecommendation(user, trueUserPosts);
	  PredictUserTrending = PredictUserTrending.trim();
  
	  // Retrieve the list of users the current user is following
	  const following = await user.getFollowing({ attributes: ["id"] });
	  const followingIds = following.map(f => f.id);
  
	  // Get pagination parameters from query; defaults: page 1, limit 5
	  let { page, limit } = req.query;
	  page = parseInt(page) || 1;
	  limit = parseInt(limit) || 5;
  
	  // Define the taxonomy list
	  const taxonomyList = [
		"Core Infrastructure & Operations",
		"Software & Application Development",
		"Data & Intelligence",
		"Security & Operations Management",
		"Emerging Technologies"
	  ];
  
	  // --- 1. Query Recommended Posts only on page 1 ---
	  let recommendedPosts = [];
	  if (page === 1 && taxonomyList.includes(PredictUserTrending)) {
		const count = await Post.count({
		  where: {
			type: term,
			mainField: PredictUserTrending,
		  }
		});
  
		// Generate two random, distinct offsets
		const offset1 = Math.floor(Math.random() * count);
		let offset2 = Math.floor(Math.random() * count);
		while (offset2 === offset1) {
		  offset2 = Math.floor(Math.random() * count);
		}
  
		// Define the common query options (without the limit)
		const queryOptions = {
		  where: {
			type: term,
			mainField: PredictUserTrending,
		  },
		  include: [
			{
			  model: User,
			  as: "Owners",
			  attributes: ["id", "username", "profilePic"],
			  through: { attributes: [] },
			  where: { id: { [Op.notIn]: [userId, ...followingIds] } },
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
			  [
				sequelize.literal(`(
				  SELECT COUNT(*) FROM postlikes AS pl WHERE pl.post_id = Post.id
				)`),
				"TotalLikeNumber"
			  ],
			  [
				sequelize.literal(`(
				  SELECT COUNT(*) FROM postreplies AS pr WHERE pr.post_id = Post.id
				)`),
				"TotalRepliesNumber"
			  ]
			]
		  },
		  order: [
			[sequelize.literal('TotalLikeNumber + TotalRepliesNumber'), 'DESC']
		  ],
		  limit: 1, // one post per query
		};
  
		// Fetch the posts using the random offsets
		const post1 = await Post.findAll({ ...queryOptions, offset: offset1 });
		const post2 = await Post.findAll({ ...queryOptions, offset: offset2 });
  
		// Combine to get 2 recommended posts
		recommendedPosts = [post1[0], post2[0]];
  
		// Add more attributes in recommended posts and map LikedUserIds
		recommendedPosts = recommendedPosts
		  .filter(p => p !== undefined)
		  .map(p => {
			const data = p.toJSON();
			return { 
			  ...data, 
			  recommend: true, 
			  LikedUserIds: data.LikedByUsers ? data.LikedByUsers.map(u => u.id) : [] 
			};
		  });
  
		// For each recommended post, if the current user has liked it, try to replace it.
		recommendedPosts = await Promise.all(
		  recommendedPosts.map(async post => {
			if (post.LikedUserIds.includes(userId)) {
			  let replacement = null;
			  let attempts = 0;
			  while (!replacement && attempts < 5) {
				const newOffset = Math.floor(Math.random() * count);
				const replacementArr = await Post.findAll({ ...queryOptions, offset: newOffset });
				if (replacementArr[0]) {
				  const replacementData = replacementArr[0].toJSON();
				  const replacementLikedUserIds = replacementData.LikedByUsers
					? replacementData.LikedByUsers.map(u => u.id)
					: [];
				  if (!replacementLikedUserIds.includes(userId)) {
					replacement = {
					  ...replacementData,
					  recommend: true,
					  LikedUserIds: replacementLikedUserIds,
					};
				  }
				}
				attempts++;
			  }
			  return replacement;
			} else {
			  return post;
			}
		  })
		);
		// Filter out any null replacements.
		recommendedPosts = recommendedPosts.filter(p => p !== null);
  
		// --- Ensure the two recommended posts are distinct ---
		// Remove duplicates based on post id.
		recommendedPosts = recommendedPosts.filter((post, index, self) =>
		  self.findIndex(p => p.id === post.id) === index
		);
  
		// If we still don't have 2 distinct recommended posts, try to fetch additional ones.
		let extraAttempts = 0;
		while (recommendedPosts.length < 2 && extraAttempts < 5) {
		  const newOffset = Math.floor(Math.random() * count);
		  const newArr = await Post.findAll({ ...queryOptions, offset: newOffset });
		  if (newArr[0]) {
			const newData = newArr[0].toJSON();
			const newLikedUserIds = newData.LikedByUsers ? newData.LikedByUsers.map(u => u.id) : [];
			if (!newLikedUserIds.includes(userId) && !recommendedPosts.some(p => p.id === newData.id)) {
			  recommendedPosts.push({
				...newData,
				recommend: true,
				LikedUserIds: newLikedUserIds,
			  });
			}
		  }
		  extraAttempts++;
		}
	  }
  
	  const feedPosts = await Post.findAndCountAll({
		where: {
		  type: term,
		},
		include: [
		  {
			model: User,
			as: "Owners",
			attributes: ["id", "username", "profilePic"],
			through: { attributes: [] },
			where: { id: { [Op.in]: followingIds } },
		  },
		  {
			model: User,
			as: "LikedByUsers",
			attributes: ["id"],
			through: { attributes: [] },
		  },
		],
		order: [
		  ["createdAt", "DESC"],
		  ["id", "DESC"]
		],
		attributes: {
		  include: [
			[
			  sequelize.literal(`(SELECT COUNT(*) FROM postlikes WHERE postlikes.post_id = Post.id)`),
			  "TotalLikeNumber"
			],
			[
			  sequelize.literal(`(SELECT COUNT(*) FROM postreplies WHERE postreplies.post_id = Post.id)`),
			  "TotalRepliesNumber"
			],
		  ],
		},
		offset: (page - 1) * limit,
		limit: limit,
		distinct: true,
	  });
  
	  const totalFeedCount = Array.isArray(feedPosts.count)
		? feedPosts.count.length
		: feedPosts.count;
  
	  const formattedFeedPosts = feedPosts.rows.map(p => {
		const postData = p.toJSON();
		return {
		  ...postData,
		  postedBy: postData.Owners && postData.Owners[0] ? postData.Owners[0].id : null,
		  UserName: postData.Owners && postData.Owners[0] ? postData.Owners[0].username : null,
		  profilePic: postData.Owners && postData.Owners[0] ? postData.Owners[0].profilePic : null,
		  LikedUserIds: postData.LikedByUsers ? postData.LikedByUsers.map(u => u.id) : [],
		};
	  });
  
	  // Append recommended posts to the start of feed posts
	  const combinedPosts = [...recommendedPosts, ...formattedFeedPosts];
  
	  // Calculate total pages and total posts (including recommended ones)
	  const totalPages = Math.ceil(totalFeedCount / limit);
	  const totalPosts = totalFeedCount + recommendedPosts.length;
  
	  return res.status(200).json({
		totalPosts,
		totalPages,
		currentPage: page,
		posts: combinedPosts,
	  });
	} catch (error) {
	  console.error("Error in getFeedPosts", error.message);
	  return res.status(500).json({ error: error.message });
	}
};
  

// Get Recruitment posts
export const getRecruitmentPosts = async (req, res) => {
	try {
	  const userId = req.user.id;
	  const term = "Recruitment";
  
	  // Find the current user
	  const user = await User.findByPk(userId);
	  if (!user) {
		return res.status(404).json({ error: "User not found" });
	  }
  
	  // Retrieve the list of users the current user is following
	  const following = await user.getFollowing({
		attributes: ["id"],
	  });
	  const followingIds = following.map((followedUser) => followedUser.id);
	  if (followingIds.length === 0) {
		return res.status(200).json({
		  totalPosts: 0,
		  totalPages: 0,
		  currentPage: 1,
		  posts: [],
		});
	  }
  
	  // Get pagination parameters from query; defaults: page 1, limit 5
	  let { page, limit } = req.query;
	  page = parseInt(page) || 1;
	  limit = parseInt(limit) || 5;
	  const offset = (page - 1) * limit;
  
	  // Retrieve posts from followed users using pagination
	  const feedPosts = await Post.findAndCountAll({
		where: { type: term },
		include: [
		  {
			model: User,
			as: "Owners", // Association alias from User.belongsToMany(Post)
			attributes: ["id", "username", "profilePic"],
			through: { attributes: [] },
			where: { id: { [Op.in]: followingIds } },
		  },
		  {
			model: User,
			as: "LikedByUsers",
			attributes: ["id"],
			through: { attributes: [] },
		  },
		],
		order: [
			["createdAt", "DESC"],
			['id', 'DESC']
		],
		attributes: {
		  include: [
			[
			  sequelize.literal(
				`(SELECT COUNT(*) FROM postlikes WHERE postlikes.post_id = Post.id)`
			  ),
			  "TotalLikeNumber",
			],
			[
			  sequelize.literal(
				`(SELECT COUNT(*) FROM postreplies WHERE postreplies.post_id = Post.id)`
			  ),
			  "TotalRepliesNumber",
			],
		  ],
		},
		offset,
		limit,
		distinct: true, // Ensures proper counting with joins
	  });
  
	  // Calculate total posts; findAndCountAll returns count which might be an array if grouping is used
	  const totalPosts = Array.isArray(feedPosts.count)
		? feedPosts.count.length
		: feedPosts.count;
  
	  // Process posts to include desired details
	  const formattedPosts = feedPosts.rows.map((p) => {
		const postData = p.toJSON();
		return {
		  ...postData,
		  postedBy: postData.Owners && postData.Owners[0] ? postData.Owners[0].id : null,
		  UserName: postData.Owners && postData.Owners[0] ? postData.Owners[0].username : null,
		  profilePic: postData.Owners && postData.Owners[0] ? postData.Owners[0].profilePic : null,
		  LikedUserIds: postData.LikedByUsers ? postData.LikedByUsers.map((user) => user.id) : [],
		};
	  });
  
	  return res.status(200).json({
		totalPosts,
		totalPages: Math.ceil(totalPosts / limit),
		currentPage: page,
		posts: formattedPosts,
	  });
	} catch (error) {
	  console.error("Error in getFeedPosts", error.message);
	  return res.status(500).json({ error: error.message });
	}
};

  
export const getUserPosts = async (req, res) => {
	try {
	  const { username } = req.params;
	  let { page, limit } = req.query;
	  page = parseInt(page) || 1;
	  limit = parseInt(limit) || 5;
	  const offset = (page - 1) * limit;
  
	  // Find the user by username
	  const user = await User.findOne({ where: { username } });
	  if (!user) {
		return res.status(404).json({ error: "User not found" });
	  }
  
	  // Retrieve posts where the user is the owner,
	  // adding two extra attributes for total likes and total replies.
	  const userPosts = await Post.findAndCountAll({
		include: [
		  {
			model: User,
			as: "Owners", // Association defined in your models (UserPost join table)
			attributes: ["id", "username", "profilePic"],
			through: { attributes: [] },
			where: { id: user.id },
		  },
		  {
			model: User,
			as: "LikedByUsers", // Association for likes
			attributes: ["id"],
			through: { attributes: [] },
		  },
		],
		attributes: {
		  include: [
			// Count likes from the postlikes table
			[
			  sequelize.literal(`(
				SELECT COUNT(*)
				FROM postlikes AS pl
				WHERE pl.post_id = Post.id
			  )`),
			  'TotalLikeNumber'
			],
			// Count replies by joining repliesuser and postreplies.
			[
			  sequelize.literal(`(
				SELECT COUNT(*)
				FROM repliesuser AS ru
				JOIN postreplies AS pr ON ru.reply_id = pr.reply_id
				WHERE pr.post_id = Post.id
			  )`),
			  'TotalRepliesNumber'
			]
		  ]
		},
		group: ['Post.id'], // Only grouping by the main table's primary key
		order: [
			['createdAt', 'DESC'],
			['id', 'DESC']
		],
		offset,
		limit,
		distinct: true, // Ensures proper counting when associations cause row duplication
	  });
  
	  // Format posts as required
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
  
	  // When using group, findAndCountAll might return count as an array.
	  const totalPosts = Array.isArray(userPosts.count)
		? userPosts.count.length
		: userPosts.count;
  
	  return res.status(200).json({
		totalPosts,
		totalPages: Math.ceil(totalPosts / limit),
		currentPage: page,
		posts: formattedPosts,
	  });
	} catch (error) {
	  console.error("Error in getUserPostsPaginated", error.message);
	  return res.status(500).json({ error: error.message });
	}
};
  

// Get reply in one post
export const getReplyPost = async (req, res) => {
	const { id } = req.params;
	try {
	  const post = await Post.findByPk(id);
	  if (!post) {
		return res.status(404).json({ error: "Post not found" });
	  }
	  const replies = await post.getReplies({
		order: [["createdAt", "DESC"]],
	  });
	  const customReplies = replies.map((reply) => ({
		...reply.toJSON(),
		post_id: post.id,
	  }));
	  res.status(200).json(customReplies);
	} catch (error) {
	  console.error("Error in getReplyPost:", error.message);
	  res.status(500).json({ error: error.message });
	}
};

// Get Filter posts
export const getFilterPosts = async (req, res) => {
	const userId = req.user.id;
	const { field } = req.params; // field is your search term
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 3;
	const offset = (page - 1) * limit;
  
	// Get filter query parameters (if any)
	const filterType = req.query.filterType;
	const sourceType = req.query.sourceType;
  
	try {
	  const user = await User.findByPk(userId);
	  if (!user) {
		return res.status(400).json({ error: "User not found" });
	  }
  
	  // Build the WHERE clause based on the search term and filters
	  let whereClause = {
		title: {
		  [Op.like]: `%${field}%`
		}
	  };
  
	  if (filterType) {
		whereClause.type = filterType;
		if (filterType === "Recruitment" && sourceType) {
		  whereClause.sourceType = sourceType;
		}
	  }
  
	  const { count, rows } = await Post.findAndCountAll({
		where: whereClause,
		include: [
		  {
			model: User,
			as: "Owners",
			through: { model: UserPost },
			attributes: ["id", "username", "profilePic"],
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
			[
				sequelize.literal(`(
				SELECT COUNT(*)
				FROM postlikes AS pl
				WHERE pl.post_id = Post.id
				)`),
				'TotalLikeNumber'
			],
			[
				sequelize.literal(`(
				SELECT COUNT(*)
				FROM postreplies AS pr
				WHERE pr.post_id = Post.id
				)`),
				'TotalRepliesNumber'
			]
			]
		},
		limit,
		offset
	  });
  
	  if (rows.length === 0) {
		return res.status(400).json({ error: "Post Not Found" });
	  }
  
	  const result = rows.map(post =>{
		const postData = post.toJSON();
		return {
		  ...postData,
		  postedBy: postData.Owners && postData.Owners[0] ? postData.Owners[0].id : null,
		  UserName: postData.Owners && postData.Owners[0] ? postData.Owners[0].username : null,
		  profilePic: postData.Owners && postData.Owners[0] ? postData.Owners[0].profilePic : null,
		  likedByUserIds: postData.LikedByUsers ? postData.LikedByUsers.map(u => u.id) : [],
		};
	  });
  
	  const totalPages = Math.ceil(count / limit);
  
	  return res.status(200).json({
		posts: result,
		totalPosts: count,
		currentPage: page,
		totalPages,
	  });
	} catch (error) {
	  console.log("Error in getFilterPosts", error.message);
	  return res.status(500).json({ error: error.message });
	}
  };

// Get Filter posts with Binary Search for prefix matching
// export const getFilterPosts = async (req, res) => {
// 	const userId = req.user.id;
// 	const { field } = req.params;
  
// 	try {
// 	  const user = await User.findByPk(userId);
// 	  if (!user) {
// 		return res.status(400).json({ error: "User not found" });
// 	  }
  
// 	  // Fetch posts including the associated users through UserPosts
// 	  const allPosts = await Post.findAll({
// 		include: [
// 		  {
// 			model: User,
// 			as: "Owners",
// 			through: { model: UserPost },
// 			attributes: ["id", "username", "profilePic"],
// 		  },
// 		],
// 	  });
  
// 	  // Sort posts by title (case-insensitive)
// 	  allPosts.sort((a, b) => 
// 		a.title.toLowerCase().localeCompare(b.title.toLowerCase())
// 	  );
  
// 	  // Binary search helper for prefix match
// 	  const binarySearchPrefix = (arr, prefix) => {
// 		let left = 0;
// 		let right = arr.length - 1;
// 		let index = -1;
// 		while (left <= right) {
// 		  const mid = Math.floor((left + right) / 2);
// 		  const title = arr[mid].title.toLowerCase();
// 		  if (title.startsWith(prefix)) {
// 			index = mid;
// 			// Continue searching to the left for the first occurrence
// 			right = mid - 1;
// 		  } else if (title < prefix) {
// 			left = mid + 1;
// 		  } else {
// 			right = mid - 1;
// 		  }
// 		}
// 		return index;
// 	  };
  
// 	  const prefix = field.toLowerCase();
// 	  const startIndex = binarySearchPrefix(allPosts, prefix);
// 	  if (startIndex === -1) {
// 		return res.status(400).json({ error: "Post Not Found" });
// 	  }
  
// 	  // Collect all posts starting with the prefix
// 	  const filterPosts = [];
// 	  for (let i = startIndex; i < allPosts.length; i++) {
// 		if (allPosts[i].title.toLowerCase().startsWith(prefix)) {
// 		  filterPosts.push(allPosts[i]);
// 		} else {
// 		  break;
// 		}
// 	  }
  
// 	  const result = filterPosts.map((post) => ({
// 		id: post.id,
// 		text: post.text,
// 		img: post.img,
// 		title: post.title,
// 		createdAt: post.createdAt,
// 		updatedAt: post.updatedAt,
// 		postedBy: post.Owners ? post.Owners[0].id : null,
// 		username: post.Owners ? post.Owners[0].username : null,
// 		profilePic: post.Owners ? post.Owners[0].profilePic : null
// 	  }));
  
// 	  return res.status(200).json(result);
// 	} catch (error) {
// 	  console.log("Error in getFilterPosts", error.message);
// 	  return res.status(500).json({ error: error.message });
// 	}
// };


//Trending topics
export const getTrendingTopics = async (req, res) => {
	try {
	  const postCounts = await Post.findAll({
		attributes: [
		  "mainField",
		  [sequelize.fn("COUNT", sequelize.col("mainField")), "count"],
		],
		group: ["mainField"],
		order: [[sequelize.literal("count"), "DESC"]],
		limit: 3,
	  });
  
	  if (!postCounts.length) {
		return res.status(404).json({ message: "No trending topics found" });
	  }
  
	  const trendingTopics = postCounts.map((topic) => {
		return {
			title: topic.mainField,
			count: topic.dataValues.count,
		}
	  });
	  return res.status(200).json({ trendingTopics });
	} catch (error) {
	  console.error("Error fetching trending topics:", error);
	  return res.status(500).json({ error: error.message });
	}
};
  
// Get Post Notifications
export const getPostNotifications = async (req, res) => {
	const userId = req.user.id;
	try {
	  const notifications = await Notification.findAll({
		where: { recipient_id: userId },
		include: [
		  {
			model: User,
			as: 'Sender',
			attributes: { exclude: ['password'] } // Exclude sensitive fields as needed
		  },
		  {
			model: User,
			as: 'Recipient',
			attributes: { exclude: ['password'] }
		  }
		],
		order: [['createdAt', 'DESC']] // Optional: order by latest notifications first
	  });
	  
	  return res.status(200).json(notifications);
	} catch (error) {
	  console.log("Error fetching post notifications:", error);
	  return res.status(500).json({ error: error.message });
	}
};

// Delete Specific Reply
export const deleteReply = async (req, res) => {
	const userId = req.user.id;
	const { id } = req.params;
	try {
	  // Include associated Users and Posts to determine reply owner and post details.
	  const reply = await Reply.findByPk(id, {
		include: [
		  { model: User, as: "Users", attributes: ["id"] },
		  { model: Post, as: "Posts", attributes: ["id"] },
		],
	  });
	  if (!reply) {
		return res.status(404).json({ error: "Reply not found" });
	  }
  
	  // Verify that the current user is associated with the reply.
	  const replyUser = await ReplyUser.findOne({
		where: {
		  user_id: userId,
		  reply_id: reply.id,
		},
	  });
	  if (!replyUser) {
		return res.status(404).json({ error: "Unauthorized! Cannot delete another user's reply!" });
	  }
  
	  // Determine the post ID associated with the reply.
	  const postId = reply.Posts && reply.Posts.length > 0 ? reply.Posts[0].id : null;
  
	  // Fetch the post to determine the owner.
	  let ownerId = null;
	  if (postId) {
		const post = await Post.findByPk(postId, {
		  include: [{ model: User, as: "Owners", attributes: ["id"] }],
		});
		if (post && post.Owners && post.Owners.length > 0) {
		  ownerId = post.Owners[0].id;
		}
	  }
  
	  // CASE 3: Delete notification if it exists for a reply action.
	  if (ownerId && ownerId !== userId && postId) {
		const notification = await Notification.findOne({
		  where: {
			sender_id: userId,
			recipient_id: ownerId,
			post_id: postId,
			action: "A user replied on your post",
		  },
		});
		if (notification) {
		  // Reload notification with associated Sender and Recipient
		  await notification.reload({
			include: [
			  { model: User, as: "Sender", attributes: { exclude: ["password"] } },
			  { model: User, as: "Recipient", attributes: { exclude: ["password"] } },
			],
		  });
		  const recipientSocketId = getRecipientSocketId(notification.recipient_id);
		  if (recipientSocketId) {
			io.to(recipientSocketId).emit("notificationDeleted", notification);
		  }
		  await notification.destroy();
		}
	  }
  
	  const deletedObj = await reply.destroy();

	  const totalReplies = await PostReply.count({ where: { post_id: postId } });

	  console.log("Total Replies Server: ", totalReplies)

	  io.to(`post_${postId}`).emit("postReplyUpdated", {
		postId: parseInt(postId, 10),
		totalReplies,
		action: "deleted"
	  });

	  res.status(200).json({ message: "Reply Deleted Successfully!", deletedObj });
	} catch (error) {
	  console.error("Error in deleteReply:", error.message);
	  res.status(500).json({ error: error.message });
	}
};
  