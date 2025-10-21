const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({error:'no token'});
  const token = h.replace('Bearer ','');
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); } catch(e){ return res.status(401).json({error:'invalid token'}); }
}

// POST /api/bookings { bus_id, seat_number }
router.post('/', auth, async (req, res) => {
  const { bus_id, seat_number } = req.body;
  const user_id = req.user.sub;
  if (!bus_id || seat_number == null) return res.status(400).json({error:'bus_id and seat_number required'});

  // check bus capacity
  const b = await db.query('SELECT capacity FROM buses WHERE id=$1', [bus_id]);
  if (!b.rowCount) return res.status(404).json({error:'bus not found'});
  const cap = b.rows[0].capacity;
  if (seat_number < 1 || seat_number > cap) return res.status(400).json({error:'invalid seat number'});

  // check if seat taken
  const taken = await db.query('SELECT id FROM bookings WHERE bus_id=$1 AND seat_number=$2', [bus_id, seat_number]);
  if (taken.rowCount) return res.status(409).json({error:'seat_taken'});

  // insert booking
  const r = await db.query('INSERT INTO bookings (bus_id, user_id, seat_number, created_at) VALUES ($1,$2,$3,now()) RETURNING id', [bus_id, user_id, seat_number]);
  res.json({ id: r.rows[0].id });
});

module.exports = router;