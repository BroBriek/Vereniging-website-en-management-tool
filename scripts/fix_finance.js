const { sequelize } = require('../models');

async function fixFinanceTable() {
    try {
        console.log('Forcing FKs OFF...');
        await sequelize.query("PRAGMA foreign_keys = OFF;");

        const queryInterface = sequelize.getQueryInterface();
        
        console.log('Checking for stuck backup tables...');
        
        // In SQLite, we can check sqlite_master
        const [results] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='FinanceItems_backup';");
        
        if (results.length > 0) {
            console.log('Found FinanceItems_backup. Dropping it...');
            await sequelize.query("DROP TABLE FinanceItems_backup;");
            console.log('Dropped FinanceItems_backup.');
        } else {
            console.log('FinanceItems_backup not found.');
        }

        console.log('Attempting to sync...');
        await sequelize.sync({ alter: true });
        console.log('Sync successful.');

    } catch (error) {
        console.error('Fix failed:', error);
    }
}

fixFinanceTable();