const express = require('express');
const multer = require('multer');
const { query } = require('../db');
const { asyncHandler, httpError } = require('../utils');
const { addMedicines } = require('../services/safetyEngine');
const { imageToText, extractCandidates } = require('../services/ocr');
const { standardize } = require('../services/rxnorm');
const { parseMedicineLine } = require('../services/parse');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|bmp|webp)$/i.test(file.mimetype)) return cb(null, true);
    cb(httpError(400, 'Please upload a PNG, JPG, BMP or WEBP image of the prescription.'));
  },
});

async function assertMemberOwned(userId, memberId) {
  const { rowCount } = await query('SELECT 1 FROM family_members WHERE id = $1 AND user_id = $2', [memberId, userId]);
  if (!rowCount) throw httpError(404, 'Family member not found.');
}

// Step 1 of the image flow: OCR + RxNorm preview. Nothing is saved yet.
router.post(
  '/prescriptions/ocr',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, 'Please choose a prescription image.');
    await assertMemberOwned(req.user.id, Number(req.body.memberId));

    let text;
    try {
      text = await imageToText(req.file.buffer);
    } catch (err) {
      console.error('[ocr]', err);
      throw httpError(500, 'Could not read the image. The OCR engine may still be downloading its language data (needs internet on first use). Please try again.');
    }

    const candidates = extractCandidates(text);
    const items = [];
    for (const c of candidates) {
      const std = await standardize(c.name);
      items.push({
        name: c.name,
        dosage: c.dosage,
        frequency: c.frequency,
        line: c.line,
        match: std ? { name: std.name, rxcui: std.rxcui, type: std.matchType, ingredients: std.ingredients.map((i) => i.name) } : null,
      });
    }
    res.json({ text, filename: req.file.originalname, items });
  })
);

// Step 2 (image) or the only step (manual): standardise, store, check.
router.post(
  '/members/:id/medicines',
  asyncHandler(async (req, res) => {
    const source = req.body.source === 'image' ? 'image' : 'manual';
    let items = Array.isArray(req.body.items) ? req.body.items : [];

    if (source === 'manual') {
      // allow the user to type "Paracetamol 500mg" in the name box
      items = items.map((it) => {
        const parsed = parseMedicineLine(it.name);
        return {
          name: parsed?.name || String(it.name || '').trim(),
          dosage: it.dosage || parsed?.dosage || null,
          frequency: it.frequency || parsed?.frequency || null,
          confirmApproximate: Boolean(it.confirmApproximate),
        };
      });
    } else {
      items = items.map((it) => ({ ...it, confirmApproximate: true })); // user reviewed the OCR list
    }

    const result = await addMedicines({
      userId: req.user.id,
      memberId: Number(req.params.id),
      items,
      source,
      ocrText: source === 'image' ? String(req.body.ocrText || '').slice(0, 20000) : null,
      filename: source === 'image' ? String(req.body.filename || '').slice(0, 255) : null,
    });
    res.status(201).json(result);
  })
);

// Mark as consumed / stopped (kept as history, no longer included in safety checks)
router.patch(
  '/medicines/:id',
  asyncHandler(async (req, res) => {
    const status = String(req.body.status || '');
    if (!['consumed', 'stopped'].includes(status)) throw httpError(400, 'Status must be "consumed" or "stopped".');
    const { rowCount } = await query(
      `UPDATE medicines m SET status = $1, ended_at = NOW()
         FROM family_members f
        WHERE m.id = $2 AND f.id = m.member_id AND f.user_id = $3 AND m.status = 'active'`,
      [status, req.params.id, req.user.id]
    );
    if (!rowCount) throw httpError(404, 'Active medicine not found.');
    res.json({ ok: true });
  })
);

router.delete(
  '/medicines/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query(
      `DELETE FROM medicines m USING family_members f
        WHERE m.id = $1 AND f.id = m.member_id AND f.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) throw httpError(404, 'Medicine not found.');
    res.json({ ok: true });
  })
);

module.exports = router;
