// Loads documented drug-drug interactions into PostgreSQL.
//   1. the small starter set (data/starter-interactions.csv), always
//   2. the full DDInter database (https://ddinter2.scbdd.com), from the CSV files in data/ddinter/
//      - if the folder is empty the script tries to download them automatically
//
// Usage: npm run import:ddinter
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { pool, migrate } = require('../src/db');
const { normalizeDrugName, orderPair } = require('../src/services/interactions');

const DDINTER_DIR = path.join(__dirname, '..', 'data', 'ddinter');
const STARTER_FILE = path.join(__dirname, '..', 'data', 'starter-interactions.csv');
const CODES = ['A', 'B', 'D', 'H', 'L', 'P', 'R', 'V']; // DDInter groups its download files by ATC letter
const BASE_URLS = [
  'https://ddinter2.scbdd.com/static/media/download',
  'https://ddinter.scbdd.com/static/media/download',
];

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

async function downloadDdinter() {
  fs.mkdirSync(DDINTER_DIR, { recursive: true });
  let ok = 0;
  for (const code of CODES) {
    const file = path.join(DDINTER_DIR, `ddinter_downloads_code_${code}.csv`);
    if (fs.existsSync(file)) {
      ok++;
      continue;
    }
    for (const base of BASE_URLS) {
      try {
        const res = await fetch(`${base}/ddinter_downloads_code_${code}.csv`, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) continue;
        const text = await res.text();
        if (!/Drug_A/i.test(text.slice(0, 300))) continue; // not the CSV we expect
        fs.writeFileSync(file, text);
        console.log(`  downloaded code ${code}`);
        ok++;
        break;
      } catch (err) {
        /* try next URL */
      }
    }
  }
  return ok;
}

// rows: [{ a, b, labelA, labelB, severity, note, source }]
async function bulkInsert(client, rows) {
  const BATCH = 5000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const res = await client.query(
      `INSERT INTO drug_interactions (name_a, name_b, label_a, label_b, severity, note, source)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
       ON CONFLICT (name_a, name_b) DO NOTHING`,
      [
        chunk.map((r) => r.a),
        chunk.map((r) => r.b),
        chunk.map((r) => r.labelA),
        chunk.map((r) => r.labelB),
        chunk.map((r) => r.severity),
        chunk.map((r) => r.note),
        chunk.map((r) => r.source),
      ]
    );
    inserted += res.rowCount;
  }
  return inserted;
}

function readStarter() {
  const records = parse(fs.readFileSync(STARTER_FILE, 'utf8'), { columns: true, skip_empty_lines: true, trim: true });
  return records.map((r) => {
    const [a, b] = orderPair(normalizeDrugName(r.drug_a), normalizeDrugName(r.drug_b));
    return {
      a,
      b,
      labelA: titleCase(r.drug_a),
      labelB: titleCase(r.drug_b),
      severity: r.severity,
      note: r.note,
      source: 'PharmaGuard starter set',
    };
  });
}

function readDdinter() {
  if (!fs.existsSync(DDINTER_DIR)) return [];
  const rows = [];
  const files = fs.readdirSync(DDINTER_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  for (const f of files) {
    const records = parse(fs.readFileSync(path.join(DDINTER_DIR, f), 'utf8'), {
      columns: (header) => header.map((h) => h.trim()),
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    });
    for (const r of records) {
      const drugA = r.Drug_A || r.drug_a;
      const drugB = r.Drug_B || r.drug_b;
      const level = r.Level || r.level || 'Unknown';
      if (!drugA || !drugB) continue;
      const [a, b] = orderPair(normalizeDrugName(drugA), normalizeDrugName(drugB));
      if (!a || !b || a === b) continue;
      rows.push({
        a,
        b,
        labelA: String(drugA).trim(),
        labelB: String(drugB).trim(),
        severity: String(level).trim() || 'Unknown',
        note: null,
        source: 'DDInter',
      });
    }
    console.log(`  read ${f}: ${records.length} rows`);
  }
  return rows;
}

async function main() {
  await migrate();
  const client = await pool.connect();
  try {
    // DDInter first so that its data wins over the starter set for the same pair.
    let files = fs.existsSync(DDINTER_DIR) ? fs.readdirSync(DDINTER_DIR).filter((f) => f.toLowerCase().endsWith('.csv')) : [];
    if (!files.length) {
      console.log('No DDInter CSV files found in backend/data/ddinter - trying to download them...');
      await downloadDdinter();
      files = fs.existsSync(DDINTER_DIR) ? fs.readdirSync(DDINTER_DIR).filter((f) => f.toLowerCase().endsWith('.csv')) : [];
    }

    await client.query('BEGIN');
    await client.query('TRUNCATE drug_interactions RESTART IDENTITY');
    let ddinterCount = 0;
    if (files.length) {
      ddinterCount = await bulkInsert(client, readDdinter());
      console.log(`DDInter: ${ddinterCount} interaction pairs loaded.`);
    }
    const starterCount = await bulkInsert(client, readStarter());
    await client.query('COMMIT');
    console.log(`Starter set: ${starterCount} additional pairs loaded.`);

    if (!files.length) {
      console.log(`
------------------------------------------------------------------------------
The full DDInter database could NOT be downloaded automatically, so only the
small starter set (${starterCount} pairs) is active. For complete coverage:
  1. Open https://ddinter2.scbdd.com/download/ in your browser
  2. Download all the CSV files (codes A, B, D, H, L, P, R, V)
  3. Put them in backend/data/ddinter/
  4. Run:  npm run import:ddinter
------------------------------------------------------------------------------`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  main()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };
