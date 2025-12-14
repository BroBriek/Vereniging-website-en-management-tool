const { sequelize } = require('../models');

async function inspectUserSchema() {
    try {
        const [results] = await sequelize.query("PRAGMA table_info(Users);");
        console.log('Columns in Users table:', results);
    } catch (error) {
        console.error(error);
    }
}

inspectUserSchema();
