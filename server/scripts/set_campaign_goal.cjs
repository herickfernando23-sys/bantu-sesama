#!/usr/bin/env node
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node set_campaign_goal.cjs <campaignId> <goal>');
    process.exit(2);
  }

  const campaignId = Number(args[0]);
  const goal = Number(args[1]);
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    console.error('Invalid campaignId');
    process.exit(2);
  }
  if (!Number.isFinite(goal) || goal < 0) {
    console.error('Invalid goal');
    process.exit(2);
  }

  // Load models from server folder
  const modelsPath = path.resolve(__dirname, '..');
  const { sequelize, Campaign } = require(path.join(modelsPath, 'models'));

  try {
    await sequelize.authenticate();
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      console.error('Campaign not found:', campaignId);
      process.exit(2);
    }

    campaign.goal = goal;
    await campaign.save();
    console.log(`Updated campaign ${campaignId} goal => ${goal}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update campaign goal:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
