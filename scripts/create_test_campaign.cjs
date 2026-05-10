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
    console.log('DB connected. Attempting to create campaign...');
    const c = await Campaign.create({ title: 'AUTO TEST CREATE', description: 'testing insert via script' });
    console.log('Created campaign id=', c.id);
    process.exit(0);
  } catch (err) {
    console.error('Create error:', err && err.message ? err.message : err);
    if (err && err.parent) console.error('DB error detail:', err.parent.message || err.parent);
    process.exit(2);
  }
}

main();
