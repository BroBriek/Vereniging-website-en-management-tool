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
  isEvent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  eventDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  bannerImage: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isTetterhoekje: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = FeedGroup;
