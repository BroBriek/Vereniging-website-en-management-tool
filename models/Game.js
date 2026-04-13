const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Game = sequelize.define('Game', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  howItWorks: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('volledige activiteit', 'kleiner spel'),
    allowNull: false
  },
  groups: {
    type: DataTypes.JSON, // Array of strings: ['Ribbel', 'Speelclub', 'Rakwi', 'Tito', 'Keti']
    allowNull: false
  },
  intensity: {
    type: DataTypes.ENUM('Laag', 'Medium', 'Hoog'),
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON, // Array of strings
    defaultValue: []
  },
  minPlayers: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  maxPlayers: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  supplies: {
    type: DataTypes.JSON, // Array of material items
    defaultValue: []
  },
  attachments: {
    type: DataTypes.JSON,
    defaultValue: [] // Array of { path, originalName, mimeType }
  }
});

module.exports = Game;
