#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Load .env manually so this script doesn't require additional packages
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

const { sequelize } = require('../server/models');

async function main() {
  try {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    const models = require('../server/models');
    const Campaign = models.Campaign;
    let table = Campaign.getTableName();
    if (typeof table === 'object' && table.tableName) table = table.tableName;
    if (!table) {
      const tables = await qi.showAllTables();
      console.error('Campaign table not found via model. All tables:', tables);
      process.exit(1);
    }
    console.log('Using table from model:', table);

    const [[{ max }]] = await sequelize.query(`SELECT MAX(id) as max FROM "${table}"`);
    const currentMax = max === null ? 0 : parseInt(max, 10);
    console.log('Current MAX(id) =', currentMax);

    const [[{ seq }]] = await sequelize.query(`SELECT pg_get_serial_sequence('"${table}"','id') as seq`);
    console.log('Sequence name from pg_get_serial_sequence ->', seq);

    await sequelize.query(`SELECT setval(pg_get_serial_sequence('"${table}"','id'), ${currentMax}, true)`);
    console.log('Sequence set to', currentMax);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
