const { sequelize, UserGroupAccess } = require('../models');

async function repair() {
    try {
        console.log('Starting DB Repair...');
        
        // 1. Clean up potential stuck backup tables
        console.log('Cleaning up backup tables...');
        await sequelize.query("DROP TABLE IF EXISTS `UserGroupAccesses_backup`");
        await sequelize.query("DROP TABLE IF EXISTS `Users_backup`");

        // 2. Backup existing data in memory
        console.log('Backing up UserGroupAccesses data...');
        let rows = [];
        try {
            [rows] = await sequelize.query("SELECT * FROM UserGroupAccesses");
            console.log(`Found ${rows.length} rows.`);
        } catch (e) {
            console.log('Could not read table (maybe it does not exist), proceeding...');
        }

        // 3. Drop the problematic table
        console.log('Dropping UserGroupAccesses...');
        await sequelize.query("PRAGMA foreign_keys = OFF");
        await sequelize.query("DROP TABLE IF EXISTS UserGroupAccesses");
        await sequelize.query("PRAGMA foreign_keys = ON");

        // 4. Recreate table using the CORRECTED model definition
        console.log('Recreating table...');
        // We use sync({ force: true }) on the specific model to recreate it based on the new class definition
        await UserGroupAccess.sync({ force: true });

        // 5. Restore data
        if (rows.length > 0) {
            console.log('Restoring data...');
            // We use bulkCreate to insert the rows back. 
            // Sequelize should respect the IDs provided in the objects.
            await UserGroupAccess.bulkCreate(rows, { validate: false });
        }

        console.log('Repair complete!');
        process.exit(0);
    } catch (e) {
        console.error('Repair failed:', e);
        process.exit(1);
    }
}

repair();
