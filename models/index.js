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
const Like = require('./Like');
const FeedGroup = require('./FeedGroup');
const UserGroupAccess = require('./UserGroupAccess');

// Associations

// Finance Hierarchy
FinanceItem.hasMany(FinanceItem, { as: 'children', foreignKey: 'parentId', onDelete: 'CASCADE' });
FinanceItem.belongsTo(FinanceItem, { as: 'parent', foreignKey: 'parentId' });

// Feed System Associations
User.hasMany(Post, { foreignKey: 'authorId', as: 'posts', onDelete: 'CASCADE', hooks: true });
Post.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

// Groups for Leidingshoekje
FeedGroup.hasMany(Post, { foreignKey: 'groupId', as: 'posts', onDelete: 'CASCADE', hooks: true });
Post.belongsTo(FeedGroup, { foreignKey: 'groupId', as: 'group' });

User.belongsToMany(FeedGroup, { through: UserGroupAccess, as: 'accessibleGroups', foreignKey: 'userId' });
FeedGroup.belongsToMany(User, { through: UserGroupAccess, as: 'members', foreignKey: 'feedGroupId' });

// Explicit relationships for cascading deletes on junction table
User.hasMany(UserGroupAccess, { foreignKey: 'userId', onDelete: 'CASCADE', hooks: true });
UserGroupAccess.belongsTo(User, { foreignKey: 'userId' });
FeedGroup.hasMany(UserGroupAccess, { foreignKey: 'feedGroupId', onDelete: 'CASCADE', hooks: true });
UserGroupAccess.belongsTo(FeedGroup, { foreignKey: 'feedGroupId' });

Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments', onDelete: 'CASCADE', hooks: true });
Comment.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(Comment, { foreignKey: 'userId', as: 'comments', onDelete: 'CASCADE', hooks: true });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' });

Comment.hasMany(Comment, { foreignKey: 'parentId', as: 'replies', onDelete: 'CASCADE', hooks: true });
Comment.belongsTo(Comment, { foreignKey: 'parentId', as: 'parent' });

Post.hasMany(PostResponse, { foreignKey: 'postId', as: 'responses', onDelete: 'CASCADE', hooks: true });
PostResponse.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(PostResponse, { foreignKey: 'userId', as: 'responses', onDelete: 'CASCADE', hooks: true });
PostResponse.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Post.hasMany(Like, { foreignKey: 'postId', as: 'likes', onDelete: 'CASCADE', hooks: true });
Like.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(Like, { foreignKey: 'userId', as: 'likes', onDelete: 'CASCADE', hooks: true });
Like.belongsTo(User, { foreignKey: 'userId', as: 'user' });


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
  PostResponse,
  Like,
  FeedGroup,
  UserGroupAccess
};
