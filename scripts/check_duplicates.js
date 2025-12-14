const { sequelize } = require('../models');

async function checkDuplicates() {
    try {
        const [results] = await sequelize.query("SELECT userId, feedGroupId, count(*) as c FROM UserGroupAccesses GROUP BY userId, feedGroupId HAVING c > 1;");
        console.log('Duplicate pairs:', results);
    } catch (error) {
        console.error(error);
    }
}

checkDuplicates();
