const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemState = sequelize.define('SystemState', {
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'SystemState',
    timestamps: true
});

module.exports = SystemState;
