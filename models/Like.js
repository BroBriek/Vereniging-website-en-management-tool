const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Like = sequelize.define('Like', {
  // Just a join table basically, but explicit model allows timestamps if needed (createdAt = when liked)
});

module.exports = Like;
