const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  target: {
    type: DataTypes.STRING, // 'all' or 'admin'
    allowNull: false,
    defaultValue: 'all'
  },
  sendNotification: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

module.exports = Announcement;
