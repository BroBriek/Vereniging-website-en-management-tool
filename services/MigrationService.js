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

            // Helper to check if table exists
            const tableExists = async (tableName) => {
                const result = await sequelize.query(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`,
                    { type: QueryTypes.SELECT }
                );
                return result.length > 0;
            };

            // Helper to check if column exists
            const columnExists = async (tableName, columnName) => {
                if (!await tableExists(tableName)) {
                    // Table doesn't exist yet, so we don't need to ALTER it.
                    // sequelize.sync() will create it with the correct columns.
                    return true;
                }
                const results = await sequelize.query(`PRAGMA table_info(${tableName});`, { type: QueryTypes.SELECT });
                return results.some(r => r.name === columnName);
            };

            // --- Users Table ---
            try {
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

                if (!await columnExists('Users', 'dismissedAnnouncements')) {
                    await sequelize.query("ALTER TABLE Users ADD COLUMN dismissedAnnouncements TEXT DEFAULT '[]';");
                    console.log('Added Users.dismissedAnnouncements');
                }
            } catch (usersErr) {
                console.error('Error migrating Users table schema:', usersErr);
            }

            // --- Forms Table ---
            try {
                if (!await columnExists('Forms', 'bannerEnabled')) {
                    await sequelize.query('ALTER TABLE Forms ADD COLUMN bannerEnabled BOOLEAN DEFAULT 0;');
                    console.log('Added Forms.bannerEnabled');
                }

                if (!await columnExists('Forms', 'bannerImage')) {
                    await sequelize.query('ALTER TABLE Forms ADD COLUMN bannerImage TEXT;');
                    console.log('Added Forms.bannerImage');
                }
            } catch (formsErr) {
                console.error('Error migrating Forms table schema:', formsErr);
            }

            // --- FormResponses Table ---
            try {
                if (!await columnExists('FormResponses', 'nickname')) {
                    await sequelize.query('ALTER TABLE FormResponses ADD COLUMN nickname TEXT;');
                    console.log('Added FormResponses.nickname');
                }
            } catch (formResponsesErr) {
                console.error('Error migrating FormResponses table schema:', formResponsesErr);
            }

            // --- Registrations Table ---
            try {
                if (!await columnExists('Registrations', 'period')) {
                    await sequelize.query('ALTER TABLE Registrations ADD COLUMN period TEXT;');
                    console.log('Added Registrations.period');
                    // Backfill default period
                    await sequelize.query("UPDATE Registrations SET period = '2024-2025' WHERE period IS NULL;");
                }
            } catch (registrationsErr) {
                console.error('Error migrating Registrations table schema:', registrationsErr);
            }

            // --- Games Table ---
            try {
                if (!await columnExists('Games', 'authorId')) {
                    await sequelize.query('ALTER TABLE Games ADD COLUMN authorId INTEGER;');
                    console.log('Added Games.authorId');
                }
            } catch (gamesErr) {
                console.error('Error migrating Games table schema:', gamesErr);
            }

            // --- FeedGroups Table ---
            try {
                if (!await columnExists('FeedGroups', 'bannerImage')) {
                    await sequelize.query('ALTER TABLE FeedGroups ADD COLUMN bannerImage TEXT;');
                    console.log('Added FeedGroups.bannerImage');
                }
            } catch (feedGroupsErr) {
                console.error('Error migrating FeedGroups table schema:', feedGroupsErr);
            }

            // --- Posts Table ---
            try {
                if (!await columnExists('Posts', 'groupId')) {
                    await sequelize.query('ALTER TABLE Posts ADD COLUMN groupId INTEGER;');
                    console.log('Added Posts.groupId');
                }
            } catch (postsErr) {
                console.error('Error migrating Posts table schema:', postsErr);
            }

            // --- Leaders Table ---
            try {
                if (!await columnExists('Leaders', 'birth_date')) {
                    await sequelize.query('ALTER TABLE Leaders ADD COLUMN birth_date DATE;');
                    console.log('Added Leaders.birth_date');
                }

                if (!await columnExists('Leaders', 'is_head_leader')) {
                    await sequelize.query('ALTER TABLE Leaders ADD COLUMN is_head_leader BOOLEAN DEFAULT 0;');
                    console.log('Added Leaders.is_head_leader');
                }
            } catch (leadersErr) {
                console.error('Error migrating Leaders table schema:', leadersErr);
            }

            // --- Events Table ---
            try {
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
            } catch (eventsErr) {
                console.error('Error migrating Events table schema:', eventsErr);
            }

            // --- FinanceItems Table ---
            try {
                if (!await columnExists('FinanceItems', 'paid')) {
                    await sequelize.query('ALTER TABLE FinanceItems ADD COLUMN paid BOOLEAN DEFAULT 1;');
                    console.log('Added FinanceItems.paid');
                }
            } catch (financeItemsErr) {
                console.error('Error migrating FinanceItems table schema:', financeItemsErr);
            }

            console.log('Automatic schema update completed.');
        } catch (error) {
            console.error('Error during automatic schema update:', error);
        }
    }
}

module.exports = MigrationService;
