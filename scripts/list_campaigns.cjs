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
    const rows = await Campaign.findAll({ attributes: ['id','title'], order: [['id','ASC']] });
    if (!rows.length) {
      console.log('No campaigns found');
      process.exit(0);
    }
    console.log('Campaigns:');
    rows.forEach(r => console.log(`${r.id}\t${r.title || '<no-title>'}`));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
