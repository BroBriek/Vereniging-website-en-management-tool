const { sequelize } = require('../models');

async function backupData() {
    try {
        const [rows] = await sequelize.query("SELECT * FROM UserGroupAccesses;");
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error(error);
    }
}

backupData();
