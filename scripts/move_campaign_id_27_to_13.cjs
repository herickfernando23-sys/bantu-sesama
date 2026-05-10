#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx);
    const val = trimmed.slice(idx + 1);
    process.env[key] = val;
  });
}

const { sequelize, Campaign } = require('../server/models');

async function main() {
  const fromId = 27;
  const toId = 13;
  try {
    await sequelize.authenticate();
    const tableNameRaw = Campaign.getTableName();
    const tableName = (typeof tableNameRaw === 'object' && tableNameRaw.tableName) ? tableNameRaw.tableName : String(tableNameRaw);

    const [[existsFrom]] = await sequelize.query(`SELECT 1 FROM "${tableName}" WHERE id = ${fromId} LIMIT 1`);
    if (!existsFrom) {
      console.error(`Campaign with id=${fromId} not found.`);
      process.exit(1);
    }
    const [[existsTo]] = await sequelize.query(`SELECT 1 FROM "${tableName}" WHERE id = ${toId} LIMIT 1`);
    if (existsTo) {
      console.error(`Target id=${toId} already exists. Aborting to avoid collision.`);
      process.exit(1);
    }

    console.log(`Moving campaign id ${fromId} -> ${toId} on table ${tableName}`);
    await sequelize.transaction(async (t) => {
      // Update FK columns in known tables
      const tablesToUpdate = [
        { name: 'Donations', col: 'campaignId' },
        { name: 'Comments', col: 'campaignId' },
        { name: 'CampaignCategories', col: 'CampaignId' },
      ];

      for (const tbl of tablesToUpdate) {
        // run both possible column name variants to be safe
        try {
          await sequelize.query(`UPDATE "${tbl.name}" SET "${tbl.col}" = ${toId} WHERE "${tbl.col}" = ${fromId}`, { transaction: t });
        } catch (e) {
          // try lowercase column
          try {
            await sequelize.query(`UPDATE "${tbl.name}" SET "${tbl.col.toLowerCase()}" = ${toId} WHERE "${tbl.col.toLowerCase()}" = ${fromId}`, { transaction: t });
          } catch (e2) {
            // ignore if table/column not exists
          }
        }
      }

      // Finally update campaigns PK
      await sequelize.query(`UPDATE "${tableName}" SET id = ${toId} WHERE id = ${fromId}`, { transaction: t });
    });

    console.log('Move completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
