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
    // In sqlite3 driver, `connection` is the raw db object.
    // For some sequelize versions/drivers it might be different, 
    // but usually this is how we run PRAGMAs.
    // However, `connection.run` is async with callbacks in sqlite3.
    // Safest way via Sequelize is raw query if possible, but hooks get raw connection.
    
    // Simple approach: Run PRAGMA on every query? No, too overhead.
    // Correct way for Sequelize v6 + SQLite:
    await new Promise((resolve, reject) => {
        connection.run('PRAGMA foreign_keys = ON', (err) => {
             if(err) reject(err);
             else resolve();
        });
    });
});

module.exports = sequelize;
