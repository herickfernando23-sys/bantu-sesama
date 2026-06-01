const { Sequelize } = require('sequelize');
const path = require('path');
const dns = require('dns');
require('dotenv').config();

try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (err) {
  // Ignore if the runtime does not support this API.
}

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/microcrowd';
const databaseSslEnabled = String(process.env.DATABASE_SSL || '').toLowerCase() === 'true';

let databaseHost = '';
try {
  databaseHost = new URL(databaseUrl).hostname;
} catch (err) {
  databaseHost = '';
}

const shouldUseSsl = databaseSslEnabled || databaseHost.endsWith('.supabase.co') || databaseHost.includes('supabase');

const sequelize = new Sequelize(databaseUrl, {
  logging: false,
  pool: {
    max: 5,
    min: 1,
    acquire: 30000,  // max time (ms) to get connection from pool
    idle: 10000      // max time (ms) connection can be idle before being released
  },
  dialectOptions: shouldUseSsl
    ? {
        family: 4,
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    : undefined,
  connectTimeoutMs: 30000,  // Time to try connection before timeout
  requestTimeout: 30000     // Time for each request
});

const User = require('./user')(sequelize);
const Campaign = require('./campaign')(sequelize);
const Donation = require('./donation')(sequelize);
const Comment = require('./comment')(sequelize);
const Category = require('./category')(sequelize);
const ChatbotInteraction = require('./chatbot_interaction')(sequelize);
const Tip = require('./tip')(sequelize);
const SponsorBanner = require('./sponsor_banner')(sequelize);

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

// Self-referencing: Donation -> ParentRecurringDonation (for recurring donation tracking)
Donation.hasMany(Donation, { foreignKey: 'parentRecurringDonationId', as: 'ChargedDonations' });
Donation.belongsTo(Donation, { foreignKey: 'parentRecurringDonationId', as: 'ParentDonation' });

module.exports = {
  sequelize,
  User,
  Campaign,
  Donation,
  Comment,
  Category,
  ChatbotInteraction,
  CampaignCategory,
  Tip,
  SponsorBanner
};
