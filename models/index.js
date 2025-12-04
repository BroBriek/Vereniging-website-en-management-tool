const sequelize = require('../config/database');
const User = require('./User');
const Leader = require('./Leader');
const Event = require('./Event');
const PageContent = require('./PageContent');
const Registration = require('./Registration');
const FinanceItem = require('./FinanceItem');
const Post = require('./Post');
const Comment = require('./Comment');
const PostResponse = require('./PostResponse');

// Associations

// Finance Hierarchy
FinanceItem.hasMany(FinanceItem, { as: 'children', foreignKey: 'parentId', onDelete: 'CASCADE' });
FinanceItem.belongsTo(FinanceItem, { as: 'parent', foreignKey: 'parentId' });

// Feed System Associations
User.hasMany(Post, { foreignKey: 'authorId', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments', onDelete: 'CASCADE' });
Comment.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(Comment, { foreignKey: 'userId', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' });

Comment.hasMany(Comment, { foreignKey: 'parentId', as: 'replies', onDelete: 'CASCADE' });
Comment.belongsTo(Comment, { foreignKey: 'parentId', as: 'parent' });

Post.hasMany(PostResponse, { foreignKey: 'postId', as: 'responses', onDelete: 'CASCADE' });
PostResponse.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(PostResponse, { foreignKey: 'userId', as: 'responses' });
PostResponse.belongsTo(User, { foreignKey: 'userId', as: 'user' });


const syncDatabase = async () => {
  try {
    // Disable foreign keys checks to allow table modifications (especially drops) in SQLite
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF');
    }

    await sequelize.sync({ alter: true });

    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON');
    }

    console.log('Database synced successfully.');
  } catch (error) {
    console.error('Error syncing database:', error);
  }
};

module.exports = {
  sequelize,
  syncDatabase,
  User,
  Leader,
  Event,
  PageContent,
  Registration,
  FinanceItem,
  Post,
  Comment,
  PostResponse
};
