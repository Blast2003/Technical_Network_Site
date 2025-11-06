// src/models/forumModel.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database.js";
import { User } from "./userModel.js";

class Forum extends Model {}
Forum.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  field_key: { type: DataTypes.STRING, allowNull: false, unique: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  member_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  created_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } },
  visibility: { type: DataTypes.ENUM('public','private'), defaultValue: 'public' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  deleted_at: { type: DataTypes.DATE, allowNull: true },
  template_threads_created: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  sequelize,
  modelName: 'Forum',
  tableName: 'forums',
  timestamps: true,
  paranoid: true,          // soft-delete support
  deletedAt: 'deleted_at', // map to your column
  indexes: [
    { fields: ['field_key'] },
    { fields: ['created_by'] },
  ],
});

class ForumMember extends Model {}
ForumMember.init({
  forum_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Forum, key: 'id' } },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  role: { type: DataTypes.ENUM('member','forum_admin','global_admin'), defaultValue: 'member' },
  joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName: 'ForumMember',
  tableName: 'forummembers',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['forum_id', 'user_id'] }, // ensure single membership row per user/forum
    { fields: ['user_id'] },
  ],
});

class Thread extends Model {}
Thread.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  forum_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Forum, key: 'id' } },
  creator_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: true },
  image_url: { type: DataTypes.STRING, allowNull: true } // support thread card image
}, { sequelize, modelName: 'Thread', tableName: 'threads', timestamps: true });

class Question extends Model {}
Question.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  thread_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Thread, key: 'id' } },
  creator_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: true },
  image_url: { type: DataTypes.STRING, allowNull: true } // support image for question
}, { sequelize, modelName: 'Question', tableName: 'questions', timestamps: true });

class Answer extends Model {}
Answer.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  question_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Question, key: 'id' } },
  sender_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  content: { type: DataTypes.TEXT, allowNull: false },
  image_url: { type: DataTypes.STRING, allowNull: true },
  parent_answer_id: { type: DataTypes.INTEGER, allowNull: true } // we'll set association below
}, { sequelize, modelName: 'Answer', tableName: 'answers', timestamps: true });

class ForumInvite extends Model {}
ForumInvite.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  forum_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Forum, key: 'id' } },
  sender_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  receiver_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  status: { type: DataTypes.ENUM('pending','accepted','declined'), defaultValue: 'pending' },
  message: { type: DataTypes.TEXT, allowNull: true },
  expires_at: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, modelName: 'ForumInvite', tableName: 'foruminvites', timestamps: true });

class ForumAudit extends Model {}
ForumAudit.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  actor_id: { type: DataTypes.INTEGER, allowNull: true },
  forum_id: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING, allowNull: false },
  meta: { type: DataTypes.JSON, allowNull: true }
}, { sequelize, modelName: 'ForumAudit', tableName: 'forumaudits', timestamps: true });

class AnswerView extends Model {}
AnswerView.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  answer_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Answer, key: 'id' } },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  seen_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { sequelize, modelName: 'AnswerView', tableName: 'answer_views', timestamps: true, indexes: [{ fields: ['answer_id'] }, { fields: ['user_id'] }] });

// -------------------- Associations --------------------
Forum.hasMany(Thread, { foreignKey: 'forum_id' });
Thread.belongsTo(Forum, { foreignKey: 'forum_id' });

Forum.hasMany(ForumMember, { foreignKey: 'forum_id' });
ForumMember.belongsTo(Forum, { foreignKey: 'forum_id' });

Thread.hasMany(Question, { foreignKey: 'thread_id' });
Question.belongsTo(Thread, { foreignKey: 'thread_id' });

Question.hasMany(Answer, { foreignKey: 'question_id', as: 'answers' });
Answer.belongsTo(Question, { foreignKey: 'question_id' });

User.hasMany(ForumMember, { foreignKey: 'user_id' });
ForumMember.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Thread, { foreignKey: 'creator_id' });
Thread.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });

User.hasMany(Question, { foreignKey: 'creator_id' });
Question.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });

User.hasMany(Answer, { foreignKey: 'sender_id' });
Answer.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// answer parent-child
Answer.hasMany(Answer, { foreignKey: 'parent_answer_id', as: 'children' });
Answer.belongsTo(Answer, { foreignKey: 'parent_answer_id', as: 'parent' });

// AnswerView associations
Answer.hasMany(AnswerView, { foreignKey: 'answer_id' });
AnswerView.belongsTo(Answer, { foreignKey: 'answer_id' });

User.hasMany(AnswerView, { foreignKey: 'user_id' });
AnswerView.belongsTo(User, { foreignKey: 'user_id' });

// Forum creator
Forum.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

export { Forum, ForumMember, Thread, Question, Answer, ForumInvite, ForumAudit, AnswerView };
