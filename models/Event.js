const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('Event', {
  title: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  startTime: { type: DataTypes.STRING, allowNull: true }, // Format "HH:mm"
  endTime: { type: DataTypes.STRING, allowNull: true },   // Format "HH:mm"
  description: { type: DataTypes.TEXT }
});

module.exports = Event;