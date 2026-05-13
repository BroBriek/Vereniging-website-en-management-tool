const { sequelize } = require('../models');

async function updateSchema() {
    try {
        const [results] = await sequelize.query("PRAGMA table_info(Forms);");
        const columns = results.map(r => r.name);

        console.log('Current columns:', columns);

        if (!columns.includes('bannerEnabled')) {
            await sequelize.query('ALTER TABLE Forms ADD COLUMN bannerEnabled BOOLEAN DEFAULT 0;');
            console.log('Column bannerEnabled added successfully.');
        } else {
            console.log('Column bannerEnabled already exists.');
        }

        if (!columns.includes('bannerImage')) {
            await sequelize.query('ALTER TABLE Forms ADD COLUMN bannerImage TEXT;');
            console.log('Column bannerImage added successfully.');
        } else {
            console.log('Column bannerImage already exists.');
        }

    } catch (error) {
        console.error('Error updating schema:', error);
    } finally {
        await sequelize.close();
    }
}

updateSchema();
