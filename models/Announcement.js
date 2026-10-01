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
      let val = rawValue;
      while (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch (_) {
          break;
        }
      }
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return ['all'];
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
  isDraft: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
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
    type: DataTypes.STRING, // 'score', 'text', 'multiple_choice', or 'multiple_choice_multi'
    allowNull: true
  },
  surveyQuestions: {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('surveyQuestions');
      if (!rawValue) return null;
      let val = rawValue;
      while (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch (_) {
          break;
        }
      }
      return Array.isArray(val) ? val : [];
    }
  }
});

module.exports = Announcement;
