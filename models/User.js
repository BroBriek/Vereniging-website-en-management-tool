const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'admin'
  },
  pushSubscriptions: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emailNotificationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notificationPreferences: {
    type: DataTypes.JSON,
    defaultValue: {
      mention: true,
      comment: true,
      reaction: true,
      newPost: true,
      birthday: true
    }
  },
  profilePicture: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  calendarToken: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  }
});

User.beforeValidate((user) => {
  if (user.username) {
    user.username = user.username.toLowerCase();
  }
});

User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  if (!user.calendarToken) {
    user.calendarToken = crypto.randomBytes(24).toString('hex');
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.prototype.validatePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;
