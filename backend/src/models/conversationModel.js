import { DataTypes, Model } from 'sequelize';
import { sequelize } from "../config/database.js";
import { User } from './userModel.js';
import { MessagesConversation } from './messageModel.js';

// Conversations
class Conversation extends Model {}
Conversation.init({}, { sequelize, modelName: 'Conversation', tableName: 'conversations', timestamps: true });

// Participants of Conversation
class ConversationParticipant extends Model {}
ConversationParticipant.init(
  {
    conversation_id: {
      type: DataTypes.INTEGER,
      primaryKey: true, // Part of composite primary key
      references: {
        model: 'conversations',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true, // Part of composite primary key
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'ConversationParticipant',
    tableName: 'conversationparticipants',
    timestamps: false,
  }
);

// Associations
Conversation.hasMany(ConversationParticipant, {
  foreignKey: 'conversation_id',
  as: 'participants', 
});

ConversationParticipant.belongsTo(Conversation, {
  foreignKey: 'conversation_id',
  as: 'conversation',
});

User.hasMany(ConversationParticipant, {
  foreignKey: 'user_id',
});

ConversationParticipant.belongsTo(User, {
  foreignKey: 'user_id',
});



// Export models
export { Conversation, ConversationParticipant };
