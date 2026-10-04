const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (username.length < 3 || username.length > 50) throw httpError(400, 'Username must be 3-50 characters.');
    if (!EMAIL_RE.test(email)) throw httpError(400, 'Please enter a valid email address.');
    if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters.');

    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username, email',
        [username, email, hash]
      );
      res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
    } catch (err) {
      if (err.code === '23505') throw httpError(409, 'That username or email is already registered.');
      throw err;
    }
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!identifier || !password) throw httpError(400, 'Please enter your username/email and password.');

    const { rows } = await query(
      'SELECT id, username, email, password_hash FROM users WHERE LOWER(username) = $1 OR email = $1',
      [identifier]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw httpError(401, 'Incorrect username/email or password.');
    }
    res.json({ token: signToken(user), user: { id: user.id, username: user.username, email: user.email } });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT id, username, email FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) throw httpError(401, 'Account not found. Please log in again.');
    res.json({ user: rows[0] });
  })
);

module.exports = router;
