const { sequelize } = require('../models');

async function addIndex() {
    try {
        console.log('Adding unique index manually...');
        await sequelize.query("CREATE UNIQUE INDEX IF NOT EXISTS user_group_unique ON UserGroupAccesses (userId, feedGroupId);");
        console.log('Index added.');
    } catch (error) {
        console.error('Error adding index:', error);
    }
}

addIndex();
