const { sequelize } = require('../models');

async function addSecondaryUserId() {
    try {
        console.log('Adding secondaryUserId column to Users table...');
        await sequelize.query('ALTER TABLE Users ADD COLUMN secondaryUserId INTEGER;');
        console.log('Column secondaryUserId added successfully.');
    } catch (error) {
        if (error.original && (error.original.message.includes('duplicate column name') || error.original.message.includes('already exists'))) {
             console.log('Column secondaryUserId already exists.');
        } else {
            console.error('Error updating schema:', error);
        }
    } finally {
        await sequelize.close();
    }
}

addSecondaryUserId();
