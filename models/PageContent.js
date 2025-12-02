const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PageContent = sequelize.define('PageContent', {
  slug: { type: DataTypes.STRING, allowNull: false }, // e.g. 'home', 'practical', 'shirts', 'departments'
  section_key: { type: DataTypes.STRING, allowNull: false }, // e.g. 'banner_title', 'intro_text'
  content: { type: DataTypes.TEXT },
  type: { type: DataTypes.STRING, defaultValue: 'text' } // 'text', 'image', 'html'
});

module.exports = PageContent;