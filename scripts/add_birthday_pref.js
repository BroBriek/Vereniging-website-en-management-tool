const { User } = require('../models');

async function updateBirthdayPrefs() {
    try {
        const users = await User.findAll();
        console.log(`Checking ${users.length} users for birthday preference...`);
        
        let updatedCount = 0;
        for (const user of users) {
            let prefs = user.notificationPreferences;
            
            // Handle string vs object (SQLite issue)
            if (typeof prefs === 'string') {
                try {
                    prefs = JSON.parse(prefs);
                } catch (e) {
                    prefs = { mention: true, comment: true, reaction: true, newPost: true };
                }
            }
            
            if (!prefs) {
                prefs = { mention: true, comment: true, reaction: true, newPost: true, birthday: true };
            }

            if (prefs.birthday === undefined) {
                prefs.birthday = true;
                user.notificationPreferences = prefs;
                user.changed('notificationPreferences', true);
                await user.save();
                updatedCount++;
            }
        }
        
        console.log(`Updated ${updatedCount} users with birthday preference.`);
    } catch (error) {
        console.error('Error updating birthday preferences:', error);
    } finally {
        process.exit();
    }
}

updateBirthdayPrefs();
