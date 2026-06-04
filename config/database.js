const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: false
});

// Enforce Foreign Keys in SQLite
// SQLite does not enforce FKs by default. We must enable it for every connection.
sequelize.addHook('afterConnect', async (connection) => {
    // Enforce foreign keys only if using SQLite dialect and the database driver supports connection.run
    if (sequelize.options.dialect === 'sqlite' && typeof connection.run === 'function') {
        await new Promise((resolve, reject) => {
            connection.run('PRAGMA foreign_keys = ON', (err) => {
                 if(err) reject(err);
                 else resolve();
            });
        });
    }
});

module.exports = sequelize;
