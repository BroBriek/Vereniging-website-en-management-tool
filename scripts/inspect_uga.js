const { sequelize } = require('../models');

async function inspectSchema() {
    try {
        const [results] = await sequelize.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='UserGroupAccesses';");
        console.log('Schema for UserGroupAccesses:');
        if (results.length > 0) {
            console.log(results[0].sql);
        } else {
            console.log('Table not found.');
        }

        const [indexes] = await sequelize.query("PRAGMA index_list('UserGroupAccesses');");
        console.log('Indexes:', indexes);

        for (const idx of indexes) {
            const [info] = await sequelize.query(`PRAGMA index_info('${idx.name}');`);
            console.log(`Index ${idx.name} info:`, info);
        }

    } catch (error) {
        console.error(error);
    }
}

inspectSchema();
