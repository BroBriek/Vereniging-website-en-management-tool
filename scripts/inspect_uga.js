const { sequelize } = require('../models');

(async () => {
  try {
    const [results, metadata] = await sequelize.query("PRAGMA index_list('UserGroupAccesses')");
    console.log('Indexes:', results);
    
    const [columns, meta] = await sequelize.query("PRAGMA table_info('UserGroupAccesses')");
    console.log('Columns:', columns);
  } catch (error) {
    console.error('Error:', error);
  }
})();