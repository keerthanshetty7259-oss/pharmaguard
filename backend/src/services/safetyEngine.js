// Runs ONCE when a new prescription / medicine is added:
//   RxNorm standardisation -> store -> duplicate check + interaction lookup against
//   (a) the person's other active medicines and (b) every other family member's active medicines
//   -> store results. Dashboards then simply read the stored results.
const { query, withTransaction } = require('../db');
const { standardize } = require('./rxnorm');
const { findInteraction, normalizeDrugName } = require('./interactions');
const { httpError } = require('../utils');

const orderById = (x, y) => (x.id < y.id ? [x, y] : [y, x]);

async function addMedicines({ userId, memberId, items, source, ocrText = null, filename = null }) {
  const memberRes = await query('SELECT id, name FROM family_members WHERE id = $1 AND user_id = $2', [memberId, userId]);
  if (!memberRes.rowCount) throw httpError(404, 'Family member not found.');
  const member = memberRes.rows[0];

  if (!Array.isArray(items) || !items.length) throw httpError(400, 'Please provide at least one medicine.');
  if (items.length > 30) throw httpError(400, 'Too many medicines in one request (max 30).');

  // 1. RxNorm standardisation
  const resolved = [];
  const notFound = [];
  const needsConfirmation = [];
  for (const item of items) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const std = await standardize(name);
    if (!std) {
      notFound.push(name);
      continue;
    }
    if (std.matchType === 'approximate' && !item.confirmApproximate) {
      needsConfirmation.push({ input: name, suggestion: { name: std.name, rxcui: std.rxcui } });
      continue;
    }
    resolved.push({
      input: name,
      dosage: item.dosage ? String(item.dosage).slice(0, 100) : null,
      frequency: item.frequency ? String(item.frequency).slice(0, 100) : null,
      std,
    });
  }

  if (needsConfirmation.length) {
    throw httpError(409, 'Please confirm the suggested medicine match.', { needsConfirmation, notFound });
  }
  if (!resolved.length) {
    throw httpError(422, 'None of the medicine names could be recognised by RxNorm. Please check the spelling or use the generic name.', { notFound });
  }

  // 2. Store + check, all in one transaction
  const outcome = await withTransaction(async (client) => {
    const pres = await client.query(
      'INSERT INTO prescriptions (member_id, source, filename, ocr_text) VALUES ($1,$2,$3,$4) RETURNING id',
      [memberId, source, filename, ocrText]
    );
    const prescriptionId = pres.rows[0].id;

    const newMeds = [];
    for (const r of resolved) {
      const ins = await client.query(
        `INSERT INTO medicines
           (member_id, prescription_id, original_name, standardized_name, rxcui,
            ingredient_rxcuis, ingredient_names, dosage, frequency, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active') RETURNING *`,
        [
          memberId,
          prescriptionId,
          r.input,
          r.std.name,
          r.std.rxcui,
          r.std.ingredients.map((i) => i.rxcui),
          r.std.ingredients.map((i) => i.name),
          r.dosage,
          r.frequency,
        ]
      );
      newMeds.push({ ...ins.rows[0], member_name: member.name });
    }

    // Every other ACTIVE medicine in this user's family (same person + other members)
    const newIds = newMeds.map((m) => m.id);
    const existing = (
      await client.query(
        `SELECT m.*, f.name AS member_name
           FROM medicines m JOIN family_members f ON f.id = m.member_id
          WHERE f.user_id = $1 AND m.status = 'active' AND NOT (m.id = ANY($2::int[]))`,
        [userId, newIds]
      )
    ).rows;

    const pairs = [];
    newMeds.forEach((n, i) => {
      existing.forEach((e) => pairs.push([n, e]));
      for (let j = i + 1; j < newMeds.length; j++) pairs.push([n, newMeds[j]]);
    });

    const interactions = [];
    const duplicates = [];

    for (const [x, y] of pairs) {
      const [a, b] = orderById(x, y);
      const scope = a.member_id === b.member_id ? 'self' : 'family';

      // B. duplicate check (shared active ingredient)
      a.ingredient_rxcuis.forEach((rxcui, idx) => {
        if (b.ingredient_rxcuis.includes(rxcui)) {
          duplicates.push({ a, b, scope, ingredient: a.ingredient_names[idx] });
        }
      });

      // A. interaction check (documented pairs from the interaction database)
      for (const na of a.ingredient_names) {
        for (const nb of b.ingredient_names) {
          if (normalizeDrugName(na) === normalizeDrugName(nb)) continue;
          const hit = await findInteraction(client, na, nb);
          if (hit) interactions.push({ a, b, scope, drugA: na, drugB: nb, hit });
        }
      }
    }

    for (const i of interactions) {
      await client.query(
        `INSERT INTO interaction_results
           (medicine_a_id, medicine_b_id, scope, drug_a, drug_b, severity, evidence, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (medicine_a_id, medicine_b_id, drug_a, drug_b) DO NOTHING`,
        [
          i.a.id,
          i.b.id,
          i.scope,
          i.drugA,
          i.drugB,
          i.hit.severity,
          i.hit.note || `${i.hit.source}: documented ${i.hit.severity.toLowerCase()} interaction between ${i.hit.label_a} and ${i.hit.label_b}.`,
          i.hit.source,
        ]
      );
    }
    for (const d of duplicates) {
      await client.query(
        `INSERT INTO duplicate_results (medicine_a_id, medicine_b_id, scope, ingredient_name)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [d.a.id, d.b.id, d.scope, d.ingredient]
      );
    }

    const describe = (m) => ({ id: m.id, name: m.original_name, standardizedName: m.standardized_name, memberId: m.member_id, memberName: m.member_name });
    return {
      prescriptionId,
      added: newMeds.map((m) => ({
        id: m.id,
        originalName: m.original_name,
        standardizedName: m.standardized_name,
        rxcui: m.rxcui,
        ingredients: m.ingredient_names,
        dosage: m.dosage,
        frequency: m.frequency,
      })),
      interactions: interactions.map((i) => ({
        scope: i.scope,
        severity: i.hit.severity,
        drugA: i.drugA,
        drugB: i.drugB,
        evidence: i.hit.note || `${i.hit.source}: documented ${i.hit.severity.toLowerCase()} interaction.`,
        source: i.hit.source,
        medicineA: describe(i.a),
        medicineB: describe(i.b),
      })),
      duplicates: duplicates.map((d) => ({
        scope: d.scope,
        ingredient: d.ingredient,
        medicineA: describe(d.a),
        medicineB: describe(d.b),
      })),
    };
  });

  return { ...outcome, notFound };
}

module.exports = { addMedicines };
