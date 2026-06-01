#!/usr/bin/env node

/**
 * Detect dan remove duplicate campaigns
 * 
 * Usage:
 *   node scripts/find_duplicates.js --dry-run
 *   node scripts/find_duplicates.js --delete
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { sequelize, Campaign } = require('../server/models');
const { Op } = require('sequelize');

const args = process.argv.slice(2);
const params = {
  dryRun: !args.includes('--delete'),
  verbose: args.includes('--verbose')
};

async function findDuplicates() {
  try {
    console.log('🔍 Scanning for duplicate campaigns...\n');

    const campaigns = await Campaign.findAll({
      attributes: ['id', 'title', 'description', 'goal', 'createdAt', 'creatorEmail'],
      order: [['createdAt', 'ASC']]
    });

    // Group by title similarity
    const titleMap = new Map();
    campaigns.forEach(campaign => {
      const normalizedTitle = campaign.title.toLowerCase().trim();
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, []);
      }
      titleMap.get(normalizedTitle).push(campaign);
    });

    let duplicateCount = 0;
    const toDelete = [];

    // Find groups with more than 1 campaign
    titleMap.forEach((group, title) => {
      if (group.length > 1) {
        console.log(`\n📌 Duplicate detected: "${title}"`);
        duplicateCount++;

        group.forEach((campaign, idx) => {
          const marker = idx === 0 ? '✓ KEEP' : '✗ DELETE';
          console.log(`   [${marker}] ID: ${campaign.id}, Goal: Rp ${campaign.goal}, Creator: ${campaign.creatorEmail}, Date: ${campaign.createdAt}`);

          if (idx > 0) {
            toDelete.push(campaign.id);
          }
        });
      }
    });

    if (toDelete.length === 0) {
      console.log('\n✅ No duplicates found!\n');
      return;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total duplicate groups: ${duplicateCount}`);
    console.log(`   Total campaigns to delete: ${toDelete.length}`);

    if (params.dryRun) {
      console.log('\n📋 DRY RUN MODE - No data will be deleted');
      console.log(`   Would delete campaigns: ${toDelete.join(', ')}\n`);
    } else {
      console.log('\n🗑️  Deleting duplicates...');
      await Campaign.destroy({
        where: {
          id: {
            [Op.in]: toDelete
          }
        }
      });
      console.log(`✅ Successfully deleted ${toDelete.length} duplicate campaigns\n`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

findDuplicates();
