const { sequelize } = require('./models');

async function updateSchema() {
    try {
        await sequelize.query('ALTER TABLE Users ADD COLUMN profilePicture TEXT;');
        console.log('Column added successfully.');
    } catch (error) {
        if (error.original && error.original.message.includes('duplicate column name')) {
             console.log('Column already exists.');
        } else {
            console.error('Error updating schema:', error);
        }
    } finally {
        await sequelize.close();
    }
}

updateSchema();
