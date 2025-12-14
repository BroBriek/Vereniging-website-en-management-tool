const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserGroupAccess = sequelize.define('UserGroupAccess', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'member',
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  feedGroupId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'FeedGroups',
      key: 'id'
    }
  }
}, {
  indexes: [
    {
      name: 'user_group_unique',
      unique: true,
      fields: ['userId', 'feedGroupId']
    }
  ]
});

module.exports = UserGroupAccess;
