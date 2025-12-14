const { sequelize } = require('../models');

async function dropAllBackups() {
    try {
        const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup';");
        
        if (tables.length === 0) {
            console.log('No backup tables found.');
            return;
        }

        console.log('Found backup tables:', tables.map(t => t.name));

        for (const table of tables) {
            console.log(`Dropping ${table.name}...`);
            await sequelize.query(`DROP TABLE IF EXISTS "${table.name}";`);
        }
        console.log('All backup tables dropped.');

    } catch (error) {
        console.error(error);
    }
}

dropAllBackups();
