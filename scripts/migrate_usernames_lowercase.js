const { User } = require('../models');

async function migrateUsernames() {
  try {
    const users = await User.findAll();
    console.log(`Found ${users.length} users. checking for mixed case usernames...`);

    for (const user of users) {
      if (user.username !== user.username.toLowerCase()) {
        const lowerName = user.username.toLowerCase();
        console.log(`Migrating "${user.username}" to "${lowerName}"...`);
        try {
          user.username = lowerName;
          await user.save();
          console.log(`Done.`);
        } catch (saveErr) {
          console.error(`Failed to save user ${user.id} (${lowerName}):`, saveErr.message);
        }
      }
    }
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrateUsernames();
