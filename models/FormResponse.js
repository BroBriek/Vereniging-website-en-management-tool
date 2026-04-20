const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FormResponse = sequelize.define('FormResponse', {
  formId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  data: {
    type: DataTypes.JSON,
    allowNull: false // Object mapping field IDs to answers
  },
  nickname: {
    type: DataTypes.STRING,
    allowNull: true
  },
  submittedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = FormResponse;
