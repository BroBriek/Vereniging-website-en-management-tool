const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KampboekjeEntry = sequelize.define('KampboekjeEntry', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: [] // Array of { path, originalName }
  },
  campName: {
    type: DataTypes.STRING,
    defaultValue: 'Zomerkamp 2026'
  },
  dayDate: {
    type: DataTypes.STRING,
    allowNull: true // e.g. "Dag 1 - 21 juli" or "2026-07-21"
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'Algemeen' // e.g. "Keuken", "Anekdote", "Recept", "Sfeer", "Algemeen"
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  isPinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

module.exports = KampboekjeEntry;
