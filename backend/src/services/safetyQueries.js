// Read-side helpers for the dashboards. They only read the results stored when medicines were
// added; a result is shown while BOTH medicines are still active.
const { query } = require('../db');
const { severityRank } = require('../utils');

const INTERACTION_SQL = `
  SELECT ir.id, ir.scope, ir.drug_a, ir.drug_b, ir.severity, ir.evidence, ir.source,
         ma.id AS med_a_id, ma.original_name AS med_a_name, ma.standardized_name AS med_a_std,
         ma.member_id AS member_a_id, fa.name AS member_a_name,
         mb.id AS med_b_id, mb.original_name AS med_b_name, mb.standardized_name AS med_b_std,
         mb.member_id AS member_b_id, fb.name AS member_b_name
    FROM interaction_results ir
    JOIN medicines ma ON ma.id = ir.medicine_a_id AND ma.status = 'active'
    JOIN medicines mb ON mb.id = ir.medicine_b_id AND mb.status = 'active'
    JOIN family_members fa ON fa.id = ma.member_id
    JOIN family_members fb ON fb.id = mb.member_id
   WHERE fa.user_id = $1`;

const DUPLICATE_SQL = `
  SELECT dr.id, dr.scope, dr.ingredient_name,
         ma.id AS med_a_id, ma.original_name AS med_a_name, ma.standardized_name AS med_a_std,
         ma.member_id AS member_a_id, fa.name AS member_a_name,
         mb.id AS med_b_id, mb.original_name AS med_b_name, mb.standardized_name AS med_b_std,
         mb.member_id AS member_b_id, fb.name AS member_b_name
    FROM duplicate_results dr
    JOIN medicines ma ON ma.id = dr.medicine_a_id AND ma.status = 'active'
    JOIN medicines mb ON mb.id = dr.medicine_b_id AND mb.status = 'active'
    JOIN family_members fa ON fa.id = ma.member_id
    JOIN family_members fb ON fb.id = mb.member_id
   WHERE fa.user_id = $1`;

const shapeInteraction = (r) => ({
  id: r.id,
  scope: r.scope,
  severity: r.severity,
  drugA: r.drug_a,
  drugB: r.drug_b,
  evidence: r.evidence,
  source: r.source,
  a: { medicineId: r.med_a_id, medicine: r.med_a_name, standardized: r.med_a_std, memberId: r.member_a_id, memberName: r.member_a_name },
  b: { medicineId: r.med_b_id, medicine: r.med_b_name, standardized: r.med_b_std, memberId: r.member_b_id, memberName: r.member_b_name },
});

const shapeDuplicate = (r) => ({
  id: r.id,
  scope: r.scope,
  ingredient: r.ingredient_name,
  a: { medicineId: r.med_a_id, medicine: r.med_a_name, standardized: r.med_a_std, memberId: r.member_a_id, memberName: r.member_a_name },
  b: { medicineId: r.med_b_id, medicine: r.med_b_name, standardized: r.med_b_std, memberId: r.member_b_id, memberName: r.member_b_name },
});

async function getInteractions(userId) {
  const { rows } = await query(INTERACTION_SQL, [userId]);
  return rows.map(shapeInteraction).sort((x, y) => severityRank(x.severity) - severityRank(y.severity));
}

async function getDuplicates(userId) {
  const { rows } = await query(DUPLICATE_SQL, [userId]);
  return rows.map(shapeDuplicate);
}

const involves = (item, memberId) => item.a.memberId === memberId || item.b.memberId === memberId;

module.exports = { getInteractions, getDuplicates, involves };
