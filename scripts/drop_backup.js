const { sequelize } = require('../models');

async function dropBackup() {
    try {
        console.log('Dropping UserGroupAccesses_backup if exists...');
        await sequelize.query("DROP TABLE IF EXISTS `UserGroupAccesses_backup`");
        console.log('Done.');
    } catch (error) {
        console.error(error);
    }
}

dropBackup();
