const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SurveyResponse = sequelize.define('SurveyResponse', {
  announcementId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  answers: {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('answers');
      if (!rawValue) return null;
      if (typeof rawValue === 'string') {
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return {};
        }
      }
      return rawValue;
    }
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['announcementId', 'userId']
    }
  ]
});

module.exports = SurveyResponse;
