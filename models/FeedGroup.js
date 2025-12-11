const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeedGroup = sequelize.define('FeedGroup', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  year: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = FeedGroup;
