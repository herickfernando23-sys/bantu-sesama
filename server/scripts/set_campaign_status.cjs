#!/usr/bin/env node
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node set_campaign_status.cjs <campaignId> <status>');
    process.exit(2);
  }

  const campaignId = Number(args[0]);
  const status = String(args[1] || '').trim().toLowerCase();
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    console.error('Invalid campaignId');
    process.exit(2);
  }
  if (!['verified','pending','rejected'].includes(status)) {
    console.error('Invalid status. Use verified|pending|rejected');
    process.exit(2);
  }

  const modelsPath = path.resolve(__dirname, '..');
  const { sequelize, Campaign } = require(path.join(modelsPath, 'models'));

  try {
    await sequelize.authenticate();
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      console.error('Campaign not found:', campaignId);
      process.exit(2);
    }

    campaign.status = status;
    await campaign.save();
    console.log(`Updated campaign ${campaignId} status => ${status}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update campaign status:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
