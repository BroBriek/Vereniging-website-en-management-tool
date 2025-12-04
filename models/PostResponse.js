const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PostResponse = sequelize.define('PostResponse', {
  type: {
    type: DataTypes.ENUM('poll', 'form'),
    allowNull: false
  },
  data: {
    type: DataTypes.JSON,
    allowNull: false // { optionIndex: Number } or { fieldName: Value, ... }
  }
});

module.exports = PostResponse;
