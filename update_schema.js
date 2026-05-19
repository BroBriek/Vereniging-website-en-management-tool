const { sequelize } = require('./models');
const MigrationService = require('./services/MigrationService');

async function updateSchema() {
    try {
        await MigrationService.run(sequelize);
        
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
