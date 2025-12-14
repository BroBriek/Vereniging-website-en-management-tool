const { sequelize, syncDatabase } = require('../models');

async function testSync() {
    try {
        console.log('Testing sync (using models/index.js logic)...');
        await syncDatabase();
        console.log('Sync complete.');
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

testSync();
