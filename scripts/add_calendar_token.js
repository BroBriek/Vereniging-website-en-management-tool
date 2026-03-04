const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const crypto = require('crypto');

// Setup independent sequelize connection to avoid loading models that might fail due to schema mismatch
const dbPath = path.join(__dirname, '../database.sqlite');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: console.log
});

async function fixCalendarToken() {
    try {
        console.log(`Attempting to update database at: ${dbPath}`);
        
        // 1. Add column (without UNIQUE constraint which SQLite doesn't support via ALTER TABLE)
        try {
            await sequelize.query('ALTER TABLE Users ADD COLUMN calendarToken VARCHAR(255);');
            console.log('✅ Column "calendarToken" added successfully.');
        } catch (error) {
            if (error.original && error.original.message.includes('duplicate column name')) {
                console.log('ℹ️ Column "calendarToken" already exists.');
            } else {
                throw error;
            }
        }

        // 2. Populate tokens for existing users
        const [users] = await sequelize.query('SELECT id, calendarToken FROM Users;');
        for (const user of users) {
            if (!user.calendarToken) {
                const newToken = crypto.randomBytes(24).toString('hex');
                await sequelize.query(`UPDATE Users SET calendarToken = ? WHERE id = ?;`, {
                    replacements: [newToken, user.id]
                });
                console.log(`Updated user ${user.id} with new calendar token.`);
            }
        }

        // 3. Add UNIQUE index manually
        try {
            await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS users_calendar_token_unique ON Users (calendarToken);');
            console.log('✅ Unique index on "calendarToken" created successfully.');
        } catch (error) {
            console.error('⚠️ Could not create unique index (might already exist):', error.message);
        }

        console.log('✅ Finished updating Users table.');
    } catch (error) {
        console.error('❌ Error updating schema:', error);
    } finally {
        await sequelize.close();
    }
}

fixCalendarToken();
