const { sequelize } = require('./models');

async function updateSchema() {
    try {
        console.log('Starting schema update...');

        // Helper to check if column exists
        async function columnExists(tableName, columnName) {
            const [results] = await sequelize.query(`PRAGMA table_info(${tableName});`);
            return results.some(r => r.name === columnName);
        }

        // --- Users Table ---
        if (!await columnExists('Users', 'profilePicture')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN profilePicture TEXT;');
            console.log('Added Users.profilePicture');
        }

        if (!await columnExists('Users', 'isActive')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN isActive BOOLEAN DEFAULT 1;');
            console.log('Added Users.isActive');
        }

        if (!await columnExists('Users', 'calendarToken')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN calendarToken TEXT;');
            // Note: UNIQUE constraint is harder to add via ALTER TABLE in SQLite, 
            // but we can at least add the column.
            console.log('Added Users.calendarToken');
        }

        if (!await columnExists('Users', 'secondaryUserId')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN secondaryUserId INTEGER;');
            console.log('Added Users.secondaryUserId');
        }

        if (!await columnExists('Users', 'email')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN email TEXT;');
            console.log('Added Users.email');
        }

        if (!await columnExists('Users', 'emailVerified')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN emailVerified BOOLEAN DEFAULT 0;');
            console.log('Added Users.emailVerified');
        }

        if (!await columnExists('Users', 'emailVerificationToken')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN emailVerificationToken TEXT;');
            console.log('Added Users.emailVerificationToken');
        }

        if (!await columnExists('Users', 'emailNotificationsEnabled')) {
            await sequelize.query('ALTER TABLE Users ADD COLUMN emailNotificationsEnabled BOOLEAN DEFAULT 0;');
            console.log('Added Users.emailNotificationsEnabled');
        }

        if (!await columnExists('Users', 'notificationPreferences')) {
            await sequelize.query("ALTER TABLE Users ADD COLUMN notificationPreferences TEXT DEFAULT '{\"mention\":true,\"comment\":true,\"reaction\":true,\"newPost\":true,\"birthday\":true}';");
            console.log('Added Users.notificationPreferences');
        }

        // --- Forms Table ---
        if (!await columnExists('Forms', 'bannerEnabled')) {
            await sequelize.query('ALTER TABLE Forms ADD COLUMN bannerEnabled BOOLEAN DEFAULT 0;');
            console.log('Added Forms.bannerEnabled');
        }

        if (!await columnExists('Forms', 'bannerImage')) {
            await sequelize.query('ALTER TABLE Forms ADD COLUMN bannerImage TEXT;');
            console.log('Added Forms.bannerImage');
        }

        // --- FormResponses Table ---
        if (!await columnExists('FormResponses', 'nickname')) {
            await sequelize.query('ALTER TABLE FormResponses ADD COLUMN nickname TEXT;');
            console.log('Added FormResponses.nickname');
        }

        // --- Registrations Table ---
        if (!await columnExists('Registrations', 'period')) {
            await sequelize.query('ALTER TABLE Registrations ADD COLUMN period TEXT;');
            console.log('Added Registrations.period');
            // Backfill default period
            await sequelize.query("UPDATE Registrations SET period = '2024-2025' WHERE period IS NULL;");
            console.log('Backfilled Registrations.period');
        }

        // --- Games Table ---
        if (!await columnExists('Games', 'authorId')) {
            await sequelize.query('ALTER TABLE Games ADD COLUMN authorId INTEGER REFERENCES Users(id) ON DELETE CASCADE;');
            console.log('Added Games.authorId');
        }

        // --- FeedGroups Table ---
        if (!await columnExists('FeedGroups', 'bannerImage')) {
            await sequelize.query('ALTER TABLE FeedGroups ADD COLUMN bannerImage TEXT;');
            console.log('Added FeedGroups.bannerImage');
        }

        // --- Posts Table ---
        if (!await columnExists('Posts', 'groupId')) {
            await sequelize.query('ALTER TABLE Posts ADD COLUMN groupId INTEGER REFERENCES FeedGroups(id) ON DELETE CASCADE;');
            console.log('Added Posts.groupId');
        }

        // --- Leaders Table ---
        if (!await columnExists('Leaders', 'birth_date')) {
            await sequelize.query('ALTER TABLE Leaders ADD COLUMN birth_date DATE;');
            console.log('Added Leaders.birth_date');
        }

        if (!await columnExists('Leaders', 'is_head_leader')) {
            await sequelize.query('ALTER TABLE Leaders ADD COLUMN is_head_leader BOOLEAN DEFAULT 0;');
            console.log('Added Leaders.is_head_leader');
        }

        // --- Events Table ---
        if (!await columnExists('Events', 'endDate')) {
            await sequelize.query('ALTER TABLE Events ADD COLUMN endDate DATE;');
            console.log('Added Events.endDate');
        }
        if (!await columnExists('Events', 'startTime')) {
            await sequelize.query('ALTER TABLE Events ADD COLUMN startTime TEXT;');
            console.log('Added Events.startTime');
        }
        if (!await columnExists('Events', 'endTime')) {
            await sequelize.query('ALTER TABLE Events ADD COLUMN endTime TEXT;');
            console.log('Added Events.endTime');
        }
        if (!await columnExists('Events', 'isPrivate')) {
            await sequelize.query('ALTER TABLE Events ADD COLUMN isPrivate BOOLEAN DEFAULT 0;');
            console.log('Added Events.isPrivate');
        }

        // --- CustomPages Table (Create if not exists) ---
        // sequelize.sync() usually handles table creation, but let's be sure.
        console.log('Ensuring all tables exist via sync...');
        await sequelize.sync();

        console.log('Schema update completed successfully.');
    } catch (error) {
        console.error('Error updating schema:', error);
    } finally {
        await sequelize.close();
    }
}

updateSchema();
