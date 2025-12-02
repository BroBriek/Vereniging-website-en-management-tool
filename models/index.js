const sequelize = require('../config/database');
const User = require('./User');
const Leader = require('./Leader');
const Event = require('./Event');
const PageContent = require('./PageContent');

const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');
  } catch (error) {
    console.error('Error syncing database:', error);
  }
};

module.exports = {
  sequelize,
  syncDatabase,
  User,
  Leader,
  Event,
  PageContent
};