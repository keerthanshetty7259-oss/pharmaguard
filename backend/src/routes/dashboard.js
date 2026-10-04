const express = require('express');
const { query } = require('../db');
const { asyncHandler, severityRank } = require('../utils');
const { getInteractions, getDuplicates, involves } = require('../services/safetyQueries');

const router = express.Router();

// Dashboard 1 - family overview
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const members = (
      await query('SELECT id, name, age, gender FROM family_members WHERE user_id = $1 ORDER BY created_at, id', [req.user.id])
    ).rows;
    const meds = (
      await query(
        `SELECT m.id, m.member_id, m.original_name, m.standardized_name, m.dosage, m.frequency
           FROM medicines m JOIN family_members f ON f.id = m.member_id
          WHERE f.user_id = $1 AND m.status = 'active' ORDER BY m.created_at, m.id`,
        [req.user.id]
      )
    ).rows;
    const [interactions, duplicates] = await Promise.all([getInteractions(req.user.id), getDuplicates(req.user.id)]);

    const out = members.map((m) => {
      const self = interactions.filter((i) => i.scope === 'self' && involves(i, m.id));
      const fam = interactions.filter((i) => i.scope === 'family' && involves(i, m.id));
      const dups = duplicates.filter((d) => involves(d, m.id));
      const worst = [...self, ...fam].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];
      return {
        ...m,
        activeMedicines: meds
          .filter((x) => x.member_id === m.id)
          .map((x) => ({ id: x.id, name: x.original_name, standardizedName: x.standardized_name, dosage: x.dosage, frequency: x.frequency })),
        flags: {
          interactions: self.length,
          duplicates: dups.length,
          familyInteractions: fam.length,
          highestSeverity: worst ? worst.severity : null,
        },
      };
    });
    res.json({ members: out });
  })
);

// Dashboard 2 - cross-family safety
router.get(
  '/family-safety',
  asyncHandler(async (req, res) => {
    const [interactions, duplicates] = await Promise.all([getInteractions(req.user.id), getDuplicates(req.user.id)]);
    res.json({
      interactions: interactions.filter((i) => i.scope === 'family'),
      duplicates: duplicates.filter((d) => d.scope === 'family'),
    });
  })
);

module.exports = router;
