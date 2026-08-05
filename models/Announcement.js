const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  target: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: '["all"]',
    get() {
      const rawValue = this.getDataValue('target');
      if (!rawValue) return ['all'];
      if (typeof rawValue === 'string') {
        try { 
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [rawValue];
        } catch (e) { 
            // Handle legacy non-JSON strings like "all" or "admin"
            return [rawValue];
        }
      }
      return Array.isArray(rawValue) ? rawValue : [rawValue];
    }
  },
  sendNotification: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  hasSurvey: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  surveyQuestion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  surveyType: {
    type: DataTypes.STRING, // 'score' or 'text'
    allowNull: true
  },
  surveyQuestions: {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('surveyQuestions');
      if (!rawValue) return null;
      if (typeof rawValue === 'string') {
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return [];
        }
      }
      return rawValue;
    }
  }
});

module.exports = Announcement;
