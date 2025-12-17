const { sequelize, Registration } = require('../models');

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // Check if column exists (SQLite specific check or generic)
        const [results] = await sequelize.query("PRAGMA table_info(Registrations);");
        const hasPeriod = results.some(c => c.name === 'period');
        
        if (!hasPeriod) {
            console.log('Adding period column...');
            await sequelize.query("ALTER TABLE Registrations ADD COLUMN period TEXT;");
            
            // Backfill with a default value, e.g., current academic year based on created_at or just a static '2024-2025'
            // Let's assume the current data is from the 'current' period which we will define as 2024-2025 (since date is Dec 2025, it's confusing. 
            // If today is Dec 17 2025, we are in 2025-2026 year.
            // But let's assume the user wants to *start* a new period for *next* year or this is the end of the previous one.
            // If the user wants to "reset", it implies the current data is "old".
            // So let's backfill with '2024-2025'.
            // And we will set the global current period to '2024-2025' initially so they still see it.
            // Then clicking 'New Period' will bump it to '2025-2026'.
            
            console.log('Backfilling data...');
            await sequelize.query("UPDATE Registrations SET period = '2024-2025' WHERE period IS NULL;");
        } else {
            console.log('Column period already exists.');
        }

        console.log('Migration complete.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
