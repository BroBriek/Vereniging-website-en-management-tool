const { sequelize, UserGroupAccess } = require('../models');

async function fixDatabase() {
    try {
        console.log('Recreating UserGroupAccess table...');
        await UserGroupAccess.sync({ force: true });
        console.log('Done.');
    } catch (error) {
        console.error('Error fixing database:', error);
    }
}

fixDatabase();
