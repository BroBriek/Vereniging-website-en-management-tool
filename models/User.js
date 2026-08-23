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
  dismissedAnnouncements: {
    type: DataTypes.JSON,
    defaultValue: []
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
  },
  secondaryUserId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  firstLogin: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  if (user.changed('isActive') && user.isActive === false) {
    user.calendarToken = crypto.randomBytes(24).toString('hex');
  }
  if (user.changed('role') && user.role === 'kookmoeke') {
    user.calendarToken = crypto.randomBytes(24).toString('hex');
  }
});

// Ensure JSON columns never get saved as empty strings (causes JSON.parse crash in SQLite)
User.beforeSave((user) => {
  if (!user.pushSubscriptions || (typeof user.pushSubscriptions === 'string' && user.pushSubscriptions.trim() === '')) {
    user.pushSubscriptions = [];
  }
  if (!user.notificationPreferences || (typeof user.notificationPreferences === 'string' && user.notificationPreferences.trim() === '')) {
    user.notificationPreferences = { mention: true, comment: true, reaction: true, newPost: true, birthday: true };
  }
  if (!user.dismissedAnnouncements || (typeof user.dismissedAnnouncements === 'string' && user.dismissedAnnouncements.trim() === '')) {
    user.dismissedAnnouncements = [];
  }
});

User.prototype.validatePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;
