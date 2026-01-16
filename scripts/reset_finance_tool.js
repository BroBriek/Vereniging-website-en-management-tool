const { sequelize, FinanceItem } = require('../models');

async function resetFinance() {
  try {
    console.log('Resetting Finance Tool...');
    
    // Disable Foreign Keys for SQLite to allow clearing self-referencing table easily
    await sequelize.query('PRAGMA foreign_keys = OFF');

    // Check for stuck backup tables and drop them
    const [results] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='FinanceItems_backup';");
    if (results.length > 0) {
        console.log('Found FinanceItems_backup. Dropping it...');
        await sequelize.query("DROP TABLE FinanceItems_backup;");
        console.log('Dropped FinanceItems_backup.');
    }
    
    // Delete all records
    // truncate: true is more efficient and resets auto-increment in some dialects, 
    // but in SQLite 'DELETE FROM' + 'DELETE FROM sqlite_sequence' is the manual reliable way.
    // Sequelize truncate for SQLite usually does DELETE FROM.
    await FinanceItem.destroy({ where: {}, truncate: true });
    
    // Explicitly reset SQLite sequence for this table to ensure IDs start from 1
    await sequelize.query("DELETE FROM sqlite_sequence WHERE name='FinanceItems'");

    await sequelize.query('PRAGMA foreign_keys = ON');
    
    console.log('Finance Tool reset successfully (FinanceItems table cleared).');
  } catch (error) {
    console.error('Error resetting finance tool:', error);
  } finally {
    await sequelize.close();
  }
}

resetFinance();
