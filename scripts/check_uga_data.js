const { sequelize } = require('../models');

async function checkData() {
    try {
        const [results] = await sequelize.query("SELECT count(*) as count FROM UserGroupAccesses;");
        console.log('Count:', results[0].count);
        
        const [rows] = await sequelize.query("SELECT * FROM UserGroupAccesses LIMIT 5;");
        console.log('Sample rows:', rows);
    } catch (error) {
        console.error(error);
    }
}

checkData();
