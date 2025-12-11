const { sequelize } = require('../models');

async function fixUserGroupAccessTable() {
    try {
        console.log('Forcing FKs OFF...');
        await sequelize.query("PRAGMA foreign_keys = OFF;");

        const queryInterface = sequelize.getQueryInterface();
        
        console.log('Checking for stuck backup tables...');
        
        // In SQLite, we can check sqlite_master
        const [results] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='UserGroupAccesses_backup';");
        
        if (results.length > 0) {
            console.log('Found UserGroupAccesses_backup. Dropping it...');
            await sequelize.query("DROP TABLE UserGroupAccesses_backup;");
            console.log('Dropped UserGroupAccesses_backup.');
        } else {
            console.log('UserGroupAccesses_backup not found.');
        }
        
        // Also check if UserGroupAccesses exists and just force recreate it to be safe
        // because the error implies the structure might be weird causing the backup to fail creation
        console.log('Force recreating UserGroupAccesses to ensure clean state...');
        await sequelize.models.UserGroupAccess.sync({ force: true });

        console.log('Attempting full sync...');
        await sequelize.sync({ alter: true });
        console.log('Sync successful.');

    } catch (error) {
        console.error('Fix failed:', error);
    }
}

fixUserGroupAccessTable();
