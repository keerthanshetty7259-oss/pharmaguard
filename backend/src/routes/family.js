const express = require('express');
const { query } = require('../db');
const { asyncHandler, httpError } = require('../utils');
const { getInteractions, getDuplicates, involves } = require('../services/safetyQueries');

const router = express.Router();
const GENDERS = ['Male', 'Female', 'Other'];

// All members (simple list, used by dropdowns and the management page)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT f.id, f.name, f.age, f.gender,
              (SELECT COUNT(*)::int FROM medicines m WHERE m.member_id = f.id AND m.status = 'active') AS active_count,
              (SELECT COUNT(*)::int FROM medicines m WHERE m.member_id = f.id AND m.status <> 'active') AS history_count
         FROM family_members f WHERE f.user_id = $1 ORDER BY f.created_at, f.id`,
      [req.user.id]
    );
    res.json({ members: rows });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const age = Number(req.body.age);
    const gender = String(req.body.gender || '');
    if (!name || name.length > 100) throw httpError(400, 'Please enter the family member\'s name.');
    if (!Number.isInteger(age) || age < 0 || age > 130) throw httpError(400, 'Please enter a valid age (0-130).');
    if (!GENDERS.includes(gender)) throw httpError(400, 'Please choose a gender.');
    const { rows } = await query(
      'INSERT INTO family_members (user_id, name, age, gender) VALUES ($1,$2,$3,$4) RETURNING id, name, age, gender',
      [req.user.id, name, age, gender]
    );
    res.status(201).json({ member: rows[0] });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM family_members WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rowCount) throw httpError(404, 'Family member not found.');
    res.json({ ok: true });
  })
);

// Detailed medicine + safety information for one member
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const memberRes = await query('SELECT id, name, age, gender FROM family_members WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (!memberRes.rowCount) throw httpError(404, 'Family member not found.');

    const meds = await query(
      `SELECT id, original_name, standardized_name, rxcui, ingredient_names, dosage, frequency, status, created_at, ended_at
         FROM medicines WHERE member_id = $1 ORDER BY (status = 'active') DESC, created_at DESC, id DESC`,
      [id]
    );
    const [interactions, duplicates] = await Promise.all([getInteractions(req.user.id), getDuplicates(req.user.id)]);

    res.json({
      member: memberRes.rows[0],
      medicines: meds.rows.map((m) => ({
        id: m.id,
        originalName: m.original_name,
        standardizedName: m.standardized_name,
        rxcui: m.rxcui,
        ingredients: m.ingredient_names,
        dosage: m.dosage,
        frequency: m.frequency,
        status: m.status,
        addedAt: m.created_at,
        endedAt: m.ended_at,
      })),
      safety: {
        interactions: interactions.filter((i) => i.scope === 'self' && involves(i, id)),
        duplicates: duplicates.filter((d) => d.scope === 'self' && involves(d, id)),
        familyInteractions: interactions.filter((i) => i.scope === 'family' && involves(i, id)),
        familyDuplicates: duplicates.filter((d) => d.scope === 'family' && involves(d, id)),
      },
    });
  })
);

module.exports = router;
