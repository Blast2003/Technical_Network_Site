import { DataTypes, Model } from 'sequelize';
import { sequelize } from "../config/database.js";
import { User } from './userModel.js';
import { Conversation } from './conversationModel.js';

// Message Model
class Message extends Model {}
Message.init(
  {
    text: { type: DataTypes.TEXT },
    seen: { type: DataTypes.BOOLEAN, defaultValue: false },
    img: { type: DataTypes.STRING, defaultValue: '' },
    lastMessage: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Message",
    tableName: "messages",
    timestamps: true,
  }
);

// Messages Sender Model
class MessagesSender extends Model {}
MessagesSender.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Message, key: 'id' },
    },
  },
  {
    sequelize,
    modelName: "MessagesSender",
    tableName: "messagessender",
    timestamps: false,
  }
);

// Messages Conversation Model
class MessagesConversation extends Model {}
MessagesConversation.init(
  {
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Message, key: 'id' },
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Conversation, key: 'id' },
    },
  },
  {
    sequelize,
    modelName: "MessagesConversation",
    tableName: "messagesconversation",
    timestamps: false,
  }
);

// Associations
Message.belongsToMany(User, {
  through: MessagesSender,
  foreignKey: 'message_id',
  as: 'senders',
});
User.belongsToMany(Message, {
  through: MessagesSender,
  foreignKey: 'user_id',
  as: 'sentMessages',
});

Message.belongsToMany(Conversation, {
  through: MessagesConversation,
  foreignKey: 'message_id',
  as: 'conversations',
});
Conversation.belongsToMany(Message, {
  through: MessagesConversation,
  foreignKey: 'conversation_id',
  as: 'messages',
});

Message.hasMany(MessagesConversation, {
  foreignKey: 'message_id',
  as: 'messagesConversations', // Ensure this alias matches the query
});

Message.hasMany(MessagesSender, {
  foreignKey: 'message_id',
  as: 'messagesSender', // Ensure this alias matches the query
});

Conversation.hasMany(MessagesConversation, {
  foreignKey: 'conversation_id',
  as: 'messagesConversations',
});

MessagesConversation.belongsTo(Conversation, {
  foreignKey: 'conversation_id',
  as: 'conversation',
});

MessagesConversation.belongsTo(Message, {
  foreignKey: 'message_id',
  as: 'message',
});

export { Message, MessagesSender, MessagesConversation };