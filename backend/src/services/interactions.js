// Drug-drug interaction lookup.
// The interaction knowledge itself comes from DDInter (loaded into the drug_interactions table by
// "npm run import:ddinter"). This file only LOOKS UP documented pairs - it never calculates
// pharmacology.

const normalizeDrugName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9+ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Pairs are stored once with the smaller name first.
const orderPair = (a, b) => (a < b ? [a, b] : [b, a]);

// db = pg Pool or Client. Returns { severity, note, source, label_a, label_b } or null.
async function findInteraction(db, nameA, nameB) {
  const [a, b] = orderPair(normalizeDrugName(nameA), normalizeDrugName(nameB));
  if (!a || !b || a === b) return null;
  const { rows } = await db.query(
    'SELECT label_a, label_b, severity, note, source FROM drug_interactions WHERE name_a = $1 AND name_b = $2',
    [a, b]
  );
  return rows[0] || null;
}

async function countInteractionPairs(db) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM drug_interactions');
  return rows[0].n;
}

module.exports = { normalizeDrugName, orderPair, findInteraction, countInteractionPairs };
