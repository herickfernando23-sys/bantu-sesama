const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Client } = require('pg');

async function listTables() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    if (res.rows.length === 0) {
      console.log('No tables found in public schema.');
    } else {
      console.log('Tables in public schema:');
      for (const r of res.rows) console.log('-', r.table_name);
    }
  } catch (err) {
    console.error('Error listing tables:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.end().catch(()=>{});
  }
}

listTables();
