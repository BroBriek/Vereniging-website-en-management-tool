const { sequelize } = require('../models');

async function migrate() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('Likes');
    
    if (!tableInfo.commentId) {
      console.log('Adding commentId column to Likes table...');
      await queryInterface.addColumn('Likes', 'commentId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Comments',
          key: 'id'
        },
        onDelete: 'CASCADE'
      });
      console.log('Column added.');
    } else {
      console.log('Column commentId already exists.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
      process.exit();
  }
}

migrate();
