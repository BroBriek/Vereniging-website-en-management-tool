const { sequelize } = require('../models');

async function checkUserDuplicates() {
    try {
        const [results] = await sequelize.query("SELECT id, count(*) as c FROM Users GROUP BY id HAVING c > 1;");
        console.log('Duplicate IDs in Users:', results);
    } catch (error) {
        console.error(error);
    }
}

checkUserDuplicates();
