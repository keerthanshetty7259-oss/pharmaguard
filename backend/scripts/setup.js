// One-time setup:  npm run setup
//  1. creates backend/.env (with a random JWT secret) if it does not exist
//  2. creates the PostgreSQL database if it does not exist, and all tables
//  3. loads the drug interaction data (DDInter + starter set)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  fs.writeFileSync(envPath, example.replace('JWT_SECRET=change-me', `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`));
  console.log('Created backend/.env  (edit DATABASE_URL and OPENAI_API_KEY there if needed)\n');
}

require('dotenv').config({ path: envPath });
const { Client } = require('pg');

async function ensureDatabase() {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pharmaguard');
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'pharmaguard';
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (err) {
    console.error(`\nCould not connect to PostgreSQL: ${err.message}`);
    console.error('Make sure PostgreSQL is installed and running, and that DATABASE_URL in backend/.env has the right user and password.\n');
    process.exit(1);
  }
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}"`);
  } else {
    console.log(`Database "${dbName}" already exists`);
  }
  await client.end();
}

(async () => {
  await ensureDatabase();
  const { main } = require('./importDdinter'); // also creates the tables
  await main();
  const { pool } = require('../src/db');
  await pool.end();
  console.log('\nSetup finished. Start the app with:  npm start   ->  http://localhost:' + (process.env.PORT || 5000));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
