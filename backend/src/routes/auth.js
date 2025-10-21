const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/auth/login { email }
router.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  // upsert user
  const r = await db.query(
    `INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email`,
    [email]
  );
  const user = r.rows[0];
  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.TOKEN_EXPIRY || '7d' });
  res.json({ token, user });
});

module.exports = router;