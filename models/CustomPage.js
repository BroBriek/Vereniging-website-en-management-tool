const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CustomPage = sequelize.define('CustomPage', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  content: {
    type: DataTypes.JSON,
    defaultValue: [] // Array of { type, ...data }
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'invisible' // 'visible', 'invisible'
  },
  showInNavbar: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isLinkOnly: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  bannerEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  bannerImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

module.exports = CustomPage;
