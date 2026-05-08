const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/microcrowd';

const sequelize = new Sequelize(databaseUrl, {
  logging: false
});

const User = require('./user')(sequelize);
const Campaign = require('./campaign')(sequelize);
const Donation = require('./donation')(sequelize);
const Comment = require('./comment')(sequelize);
const Category = require('./category')(sequelize);
const ChatbotInteraction = require('./chatbot_interaction')(sequelize);

const CampaignCategory = sequelize.define('CampaignCategory', {}, { timestamps: false });

// Relations
User.hasMany(Campaign, { foreignKey: 'userId' });
Campaign.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Donation, { foreignKey: 'userId' });
Donation.belongsTo(User, { foreignKey: 'userId' });

Campaign.hasMany(Donation, { foreignKey: 'campaignId' });
Donation.belongsTo(Campaign, { foreignKey: 'campaignId' });

Campaign.hasMany(Comment, { foreignKey: 'campaignId' });
Comment.belongsTo(Campaign, { foreignKey: 'campaignId' });

User.hasMany(Comment, { foreignKey: 'userId' });
Comment.belongsTo(User, { foreignKey: 'userId' });

Campaign.belongsToMany(Category, { through: CampaignCategory });
Category.belongsToMany(Campaign, { through: CampaignCategory });

// Chatbot interactions
User.hasMany(ChatbotInteraction, { foreignKey: 'userId' });
ChatbotInteraction.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Campaign,
  Donation,
  Comment,
  Category,
  ChatbotInteraction,
  CampaignCategory
};
