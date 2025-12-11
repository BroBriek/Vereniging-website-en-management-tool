const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Post = sequelize.define('Post', {
  content: {
    type: DataTypes.TEXT,
    allowNull: true // Can be null if it's just a poll or file post
  },
  attachments: {
    type: DataTypes.JSON,
    defaultValue: [] // Array of { path, originalName, mimeType }
  },
  poll: {
    type: DataTypes.JSON,
    allowNull: true // { question: String, options: [String], allowMultiple: Boolean }
  },
  form: {
    type: DataTypes.JSON,
    allowNull: true // [{ label: String, type: String, required: Boolean, options: [String] }]
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

module.exports = Post;
