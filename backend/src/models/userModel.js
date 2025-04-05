import { DataTypes, Model } from 'sequelize';
import {sequelize} from "../config/database.js";


// Users Table
class User extends Model {}
User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  username: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  profilePic: { type: DataTypes.STRING, defaultValue: '' },
  bio: { type: DataTypes.TEXT },
  isFrozen: { type: DataTypes.BOOLEAN, defaultValue: false },
  position: { type: DataTypes.STRING, defaultValue: null },
}, { sequelize, modelName: 'User', tableName: 'users', timestamps: true });

// Followers (Self-referential Many-to-Many)
class Follower extends Model {}
Follower.init({}, { sequelize, modelName: 'Follower', tableName: 'followers', timestamps: false });
User.belongsToMany(User, { through: Follower, as: 'Followers', foreignKey: 'following_id' });
User.belongsToMany(User, { through: Follower, as: 'Following', foreignKey: 'follower_id' });


export {User, Follower};