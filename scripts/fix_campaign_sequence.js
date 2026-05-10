#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { sequelize } = require('../server/models');

async function main() {
  try {
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    let tables = await qi.showAllTables();
    tables = tables.map(t => (typeof t === 'object' && t.tableName) ? t.tableName : String(t));
    const table = tables.find(t => t.toLowerCase().includes('campaign'));
    if (!table) {
      console.error('Campaign table not found. Tables:', tables);
      process.exit(1);
    }
    console.log('Using table:', table);

    const [[{ max }]] = await sequelize.query(`SELECT MAX(id) as max FROM "${table}"`);
    const currentMax = max === null ? 0 : parseInt(max, 10);
    console.log('Current MAX(id) =', currentMax);

    const [[{ seq }]] = await sequelize.query(`SELECT pg_get_serial_sequence('${table}','id') as seq`);
    console.log('Sequence name from pg_get_serial_sequence ->', seq);

    await sequelize.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), ${currentMax}, true)`);
    console.log('Sequence set to', currentMax);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
