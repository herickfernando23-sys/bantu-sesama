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
  try {
    await sequelize.authenticate();
    const tableNameRaw = Campaign.getTableName();
    const tableName = (typeof tableNameRaw === 'object' && tableNameRaw.tableName) ? tableNameRaw.tableName : String(tableNameRaw);
    console.log('Setting sequence for table:', tableName, 'so next id will be 13');
    await sequelize.query(`SELECT setval(pg_get_serial_sequence('"${tableName}"','id'), 12, true)`);
    const [[{ next }]] = await sequelize.query(`SELECT nextval(pg_get_serial_sequence('"${tableName}"','id')) as next`);
    console.log('Next sequence value (after nextval) =', next);
    process.exit(0);
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
