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

    const candidates = await Campaign.findAll({ where: { title: 'a' }, attributes: ['id','title'] });
    if (!candidates.length) {
      console.log('No placeholder campaigns with title "a" found.');
    } else {
      console.log('Found placeholder campaigns to delete:');
      console.log(candidates.map(c => c.id).join(', '));
      const ids = candidates.map(c => c.id);
      const deleted = await Campaign.destroy({ where: { id: ids } });
      console.log('Deleted count:', deleted);
    }

    // Recompute MAX(id) and reset sequence
    const tableNameRaw = Campaign.getTableName();
    const tableName = (typeof tableNameRaw === 'object' && tableNameRaw.tableName) ? tableNameRaw.tableName : String(tableNameRaw);
    const [[{ max }]] = await sequelize.query(`SELECT MAX(id) as max FROM "${tableName}"`);
    const currentMax = max === null ? 0 : parseInt(max, 10);
    console.log('Current MAX(id) after delete =', currentMax);

    const [[{ seq }]] = await sequelize.query(`SELECT pg_get_serial_sequence('"${tableName}"','id') as seq`);
    console.log('Sequence name ->', seq);

    await sequelize.query(`SELECT setval(pg_get_serial_sequence('"${tableName}"','id'), ${currentMax}, true)`);
    console.log('Sequence set to', currentMax);

    const [[{ next }]] = await sequelize.query(`SELECT nextval(pg_get_serial_sequence('"${tableName}"','id')) as next`);
    console.log('Next sequence value (after nextval) =', next);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
