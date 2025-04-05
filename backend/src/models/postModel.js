import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import { User } from './userModel.js';

/**
 * Post Model
 */
class Post extends Model {}
Post.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  img: { type: DataTypes.STRING, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: false },
  hashtag: { type: DataTypes.STRING, allowNull: false },
  mainField: {type: DataTypes.STRING, allowNull: false, defaultValue: ''},
  sourceType: {type: DataTypes.STRING, allowNull: false, defaultValue: ''}
}, { sequelize, modelName: 'Post', tableName: 'posts', timestamps: true });

/**
 * Many-to-Many: Users <-> Posts (Ownership)
 */
class UserPost extends Model {}
UserPost.init({
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  post_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Post, key: 'id' } },
}, { sequelize, modelName: 'UserPost', tableName: 'userposts', timestamps: false });

/**
 * Reply Model
 */
class Reply extends Model {}
Reply.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  text: { type: DataTypes.TEXT, allowNull: false },
  username: { type: DataTypes.STRING, allowNull: true },
  userProfilePic: { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, modelName: 'Reply', tableName: 'replies', timestamps: true });

/**
 * Many-to-Many: Users <-> Replies
 */
class ReplyUser extends Model {}
ReplyUser.init({
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  reply_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Reply, key: 'id' } },
}, { sequelize, modelName: 'ReplyUser', tableName: 'repliesuser', timestamps: false });

/**
 * Many-to-Many: Posts <-> Replies
 */
class PostReply extends Model {}
PostReply.init({
  post_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Post, key: 'id' } },
  reply_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Reply, key: 'id' } },
}, { sequelize, modelName: 'PostReply', tableName: 'postreplies', timestamps: false });

/**
 * Many-to-Many: Users <-> Posts (Likes)
 */
class PostLike extends Model {}
PostLike.init({
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  post_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Post, key: 'id' } },
}, { sequelize, modelName: 'PostLike', tableName: 'postlikes', timestamps: false });

/**
 * Define Associations
 */
User.belongsToMany(Post, { through: UserPost, foreignKey: 'user_id', as: 'OwnedPosts' });
Post.belongsToMany(User, { through: UserPost, foreignKey: 'post_id', as: 'Owners' });

User.belongsToMany(Reply, { through: ReplyUser, foreignKey: 'user_id', as: 'Replies' });
Reply.belongsToMany(User, { through: ReplyUser, foreignKey: 'reply_id', as: 'Users' });

Post.belongsToMany(Reply, { through: PostReply, foreignKey: 'post_id', as: 'Replies' });
Reply.belongsToMany(Post, { through: PostReply, foreignKey: 'reply_id', as: 'Posts' });

User.belongsToMany(Post, { through: PostLike, foreignKey: 'user_id', as: 'LikedPosts' });
Post.belongsToMany(User, { through: PostLike, foreignKey: 'post_id', as: 'LikedByUsers' });

export { Post, UserPost, Reply, ReplyUser, PostReply, PostLike };
