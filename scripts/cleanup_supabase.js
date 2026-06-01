#!/usr/bin/env node

/**
 * Cleanup script untuk mengurangi penggunaan Supabase
 * 
 * Usage:
 *   node scripts/cleanup_supabase.js --chatbot-days 30
 *   node scripts/cleanup_supabase.js --chatbot-days 30 --tips-days 60 --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { sequelize, ChatbotInteraction, Tip, Donation } = require('../server/models');
const { Op } = require('sequelize');

// Parse command line arguments
const args = process.argv.slice(2);
const params = {
  chatbotDays: 30,
  tipsDays: 60,
  dryRun: false,
  verbose: false
};

args.forEach((arg, i) => {
  if (arg === '--chatbot-days' && args[i + 1]) params.chatbotDays = parseInt(args[i + 1]);
  if (arg === '--tips-days' && args[i + 1]) params.tipsDays = parseInt(args[i + 1]);
  if (arg === '--dry-run') params.dryRun = true;
  if (arg === '--verbose') params.verbose = true;
});

async function cleanup() {
  try {
    console.log('🔄 Starting Supabase cleanup...\n');
    if (params.dryRun) console.log('📋 DRY RUN MODE - No data will be deleted\n');

    // ====================================
    // 1. Delete old chatbot interactions
    // ====================================
    console.log(`📝 Chatbot Interactions (keeping last ${params.chatbotDays} days)...`);
    const chatbotCutoffDate = new Date();
    chatbotCutoffDate.setDate(chatbotCutoffDate.getDate() - params.chatbotDays);

    const chatbotCount = await ChatbotInteraction.count({
      where: {
        createdAt: {
          [Op.lt]: chatbotCutoffDate
        }
      }
    });

    if (chatbotCount > 0) {
      console.log(`   Found ${chatbotCount} old records to delete`);
      if (!params.dryRun) {
        await ChatbotInteraction.destroy({
          where: {
            createdAt: {
              [Op.lt]: chatbotCutoffDate
            }
          }
        });
        console.log(`   ✅ Deleted ${chatbotCount} chatbot interactions\n`);
      } else {
        console.log(`   [DRY RUN] Would delete ${chatbotCount} records\n`);
      }
    } else {
      console.log(`   ✅ No old records found\n`);
    }

    // ====================================
    // 2. Delete old tips
    // ====================================
    console.log(`💰 Tips (keeping last ${params.tipsDays} days)...`);
    const tipsCutoffDate = new Date();
    tipsCutoffDate.setDate(tipsCutoffDate.getDate() - params.tipsDays);

    const tipsCount = await Tip.count({
      where: {
        createdAt: {
          [Op.lt]: tipsCutoffDate
        }
      }
    });

    if (tipsCount > 0) {
      console.log(`   Found ${tipsCount} old records to delete`);
      if (!params.dryRun) {
        await Tip.destroy({
          where: {
            createdAt: {
              [Op.lt]: tipsCutoffDate
            }
          }
        });
        console.log(`   ✅ Deleted ${tipsCount} old tips\n`);
      } else {
        console.log(`   [DRY RUN] Would delete ${tipsCount} records\n`);
      }
    } else {
      console.log(`   ✅ No old records found\n`);
    }

    // ====================================
    // 3. Check database statistics
    // ====================================
    console.log('📊 Database Statistics:');
    const stats = {
      campaigns: await sequelize.models.Campaign.count(),
      donations: await sequelize.models.Donation.count(),
      chatbotInteractions: await sequelize.models.ChatbotInteraction.count(),
      tips: await sequelize.models.Tip.count(),
      users: await sequelize.models.User.count()
    };

    Object.entries(stats).forEach(([key, count]) => {
      console.log(`   ${key}: ${count} records`);
    });

    console.log('\n✅ Cleanup completed!\n');

    // ====================================
    // 4. Recommendations
    // ====================================
    console.log('💡 Additional Recommendations:');
    console.log('   1. Schedule this cleanup weekly: crontab -e');
    console.log('      0 2 * * 0 cd /path/to/app && node scripts/cleanup_supabase.js --chatbot-days 30 --tips-days 60');
    console.log('   2. Archive old donations (> 1 year) to separate table');
    console.log('   3. Use Supabase API tokens with limited scope');
    console.log('   4. Monitor usage at: https://app.supabase.com/project/YOUR_PROJECT/settings/billing');
    console.log('\n');

  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

cleanup();
