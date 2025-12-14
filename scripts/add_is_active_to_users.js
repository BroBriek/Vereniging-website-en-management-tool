const { Sequelize } = require('sequelize');
const path = require('path');

// Setup independent sequelize connection to avoid loading models that might fail due to schema mismatch
const dbPath = path.join(__dirname, '../database.sqlite');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: console.log
});

async function addIsActiveColumn() {
    try {
        console.log(`Attempting to update database at: ${dbPath}`);
        await sequelize.query('ALTER TABLE Users ADD COLUMN isActive BOOLEAN DEFAULT 1;');
        console.log('✅ Column "isActive" added successfully.');
    } catch (error) {
        if (error.original && error.original.message.includes('duplicate column name')) {
             console.log('ℹ️ Column "isActive" already exists.');
        } else {
            console.error('❌ Error updating schema:', error);
        }
    } finally {
        await sequelize.close();
    }
}

addIsActiveColumn();
