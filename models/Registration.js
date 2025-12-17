const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Registration = sequelize.define('Registration', {
  type: {
    type: DataTypes.ENUM('lid', 'leiding'),
    defaultValue: 'lid',
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  birthdate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  // Specific for 'lid' (Member)
  memberPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  parentsNames: {
    type: DataTypes.STRING,
    allowNull: true 
  },
  parentsPhone: { // Used for 'lid'
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: { // Used for 'leiding'
    type: DataTypes.STRING,
    allowNull: true
  },
  email: { // Parents email for lid, Leader email for leiding
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
        isEmail: true
    }
  },
  photoPermission: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Common
  medicalInfo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  group: {
    type: DataTypes.ENUM('ribbel', 'speelclub', 'rakwi', 'tito', 'keti', 'aspi'),
    allowNull: false
  },
  privacyAccepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  period: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = Registration;
