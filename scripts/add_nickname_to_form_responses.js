const { sequelize } = require('../models');

async function updateSchema() {
    try {
        console.log('Adding nickname column to FormResponses table...');
        await sequelize.query('ALTER TABLE FormResponses ADD COLUMN nickname TEXT;');
        console.log('Column added successfully.');
    } catch (error) {
        if (error.original && (error.original.message.includes('duplicate column name') || error.original.message.includes('already exists'))) {
             console.log('Column already exists.');
        } else {
            console.error('Error updating schema:', error);
        }
    } finally {
        await sequelize.close();
    }
}

updateSchema();
