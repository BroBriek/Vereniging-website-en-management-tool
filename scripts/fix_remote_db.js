const { Sequelize } = require('sequelize');
const path = require('path');

// Pas dit pad aan als de database op de remote server ergens anders staat
const dbPath = path.join(__dirname, '../database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: console.log
});

async function fixDatabase() {
  try {
    console.log(`Connecting to database at ${dbPath}...`);
    console.log("Starting fix...");

    // 1. Drop the backup table if it exists (leftover from crash)
    console.log("Dropping UserGroupAccesses_backup...");
    await sequelize.query("DROP TABLE IF EXISTS `UserGroupAccesses_backup`");

    // 2. Find and drop the unique index on UserGroupAccesses
    console.log("Checking indexes on UserGroupAccesses...");
    const [indexes] = await sequelize.query("PRAGMA index_list('UserGroupAccesses')");
    
    let indexDropped = false;
    for (const index of indexes) {
        // We look for the unique index that is NOT the primary key (pk)
        if (index.unique && index.origin === 'c') { 
             console.log(`Found unique index: ${index.name}. Dropping...`);
             await sequelize.query(`DROP INDEX IF EXISTS "${index.name}"`);
             indexDropped = true;
        }
    }

    if (!indexDropped) {
        console.log("No conflicting index found. This might be fine if it was already removed.");
    }

    console.log("Fix complete. The next server start should correctly recreate the index.");

  } catch (error) {
    console.error("Error fixing database:", error);
  } finally {
    await sequelize.close();
  }
}

fixDatabase();
