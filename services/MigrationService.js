const { QueryTypes } = require('sequelize');

/**
 * MigrationService
 * Handles manual schema updates (ALTER TABLE) that Sequelize's sync({alter: true}) 
 * often struggles with in SQLite.
 */
class MigrationService {
    static async run(sequelize) {
        try {
            console.log('Starting automatic schema update check...');

            // Helper to check if column exists
            const columnExists = async (tableName, columnName) => {
                const results = await sequelize.query(`PRAGMA table_info(${tableName});`, { type: QueryTypes.SELECT });
                return results.some(r => r.name === columnName);
            };

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
            }

            // --- Games Table ---
            if (!await columnExists('Games', 'authorId')) {
                await sequelize.query('ALTER TABLE Games ADD COLUMN authorId INTEGER;');
                console.log('Added Games.authorId');
            }

            // --- FeedGroups Table ---
            if (!await columnExists('FeedGroups', 'bannerImage')) {
                await sequelize.query('ALTER TABLE FeedGroups ADD COLUMN bannerImage TEXT;');
                console.log('Added FeedGroups.bannerImage');
            }

            // --- Posts Table ---
            if (!await columnExists('Posts', 'groupId')) {
                await sequelize.query('ALTER TABLE Posts ADD COLUMN groupId INTEGER;');
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
            if (!await columnExists('Events', 'isArchived')) {
                await sequelize.query('ALTER TABLE Events ADD COLUMN isArchived BOOLEAN DEFAULT 0;');
                console.log('Added Events.isArchived');
            }
            if (!await columnExists('Events', 'attachments')) {
                await sequelize.query("ALTER TABLE Events ADD COLUMN attachments TEXT DEFAULT '[]';");
                console.log('Added Events.attachments');
            }

            console.log('Automatic schema update completed.');
        } catch (error) {
            console.error('Error during automatic schema update:', error);
        }
    }
}

module.exports = MigrationService;
