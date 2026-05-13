const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Form = sequelize.define('Form', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  fields: {
    type: DataTypes.JSON,
    defaultValue: [] // Array of { type, label, placeholder, options, required, id }
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'invisible' // 'visible', 'invisible', 'closed'
  },
  sendEmailOverview: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailFieldId: {
    type: DataTypes.STRING,
    allowNull: true
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

module.exports = Form;
