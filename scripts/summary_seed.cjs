#!/usr/bin/env node
const path = require('path');
const { sequelize, Campaign, Donation } = require('../server/models');

async function main() {
  try {
    await sequelize.authenticate();
    const camps = await Campaign.findAll({ limit: 20, order: [['id','ASC']] });
    console.log('Campaigns:');
    for (const c of camps) {
      const donations = await Donation.count({ where: { campaignId: c.id } });
      console.log(`- id=${c.id} title="${c.title}" goal=${c.goal} collected=${c.collected} donations=${donations}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
