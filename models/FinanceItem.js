const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FinanceItem = sequelize.define('FinanceItem', {
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  amount: { 
    type: DataTypes.DECIMAL(10, 2), 
    allowNull: true, // Null = Folder, Value = Transaction
    defaultValue: null
  },
  date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
    allowNull: true
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'FinanceItems',
      key: 'id'
    }
  }
});

module.exports = FinanceItem;