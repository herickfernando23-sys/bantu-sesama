#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const loadEnvFile = (filePath, overwrite = true) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx);
    const val = trimmed.slice(idx + 1);
    if (!overwrite && Object.prototype.hasOwnProperty.call(process.env, key)) return;
    process.env[key] = val;
  });
};

// Mirror backend runtime loading order:
// 1) server/.env, 2) root .env without overriding existing keys.
loadEnvFile(path.resolve(__dirname, '../server/.env'), true);
loadEnvFile(path.resolve(__dirname, '../.env'), false);

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
