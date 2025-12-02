const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Leader = sequelize.define('Leader', {
  name: { type: DataTypes.STRING, allowNull: false },
  group: { type: DataTypes.STRING, allowNull: false }, // 'Ribbels', 'Speelclub', etc.
  image: { type: DataTypes.STRING },
  years_active: { type: DataTypes.INTEGER },
  study: { type: DataTypes.STRING },
  extra_info: { type: DataTypes.TEXT }
});

module.exports = Leader;