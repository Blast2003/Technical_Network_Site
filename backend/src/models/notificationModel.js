import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import { User } from './userModel.js';
import { Post } from './postModel.js';

class Notification extends Model {}

Notification.init({
  notification_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  post_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Post,
      key: 'id',
    },
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '',
  },
  seen: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'Notification',
  tableName: 'notifications',
  timestamps: true, 
});

// Define associations
// Each notification is sent by a User (sender) and received by another User (recipient)
Notification.belongsTo(User, { foreignKey: 'sender_id', as: 'Sender' });
Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'Recipient' });
// Each notification is associated with a Post
Notification.belongsTo(Post, { foreignKey: 'post_id', as: 'Post' });

// Optionally, you can define the reverse associations if needed
User.hasMany(Notification, { foreignKey: 'sender_id', as: 'SentNotifications' });
User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'ReceivedNotifications' });
Post.hasMany(Notification, { foreignKey: 'post_id', as: 'Notifications' });

export { Notification };
