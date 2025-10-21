const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/buses
router.get('/', async (req, res) => {
  const r = await db.query(`SELECT id, name, driver_name, capacity, route FROM buses ORDER BY id`);
  res.json(r.rows);
});

// GET /api/buses/:id/seats - returns seat layout and bookings
router.get('/:id/seats', async (req, res) => {
  const busId = req.params.id;
  const bus = await db.query('SELECT id, capacity FROM buses WHERE id=$1', [busId]);
  if (!bus.rowCount) return res.status(404).json({error:'not found'});
  const capacity = bus.rows[0].capacity;
  const bookings = await db.query('SELECT seat_number, user_id FROM bookings WHERE bus_id=$1', [busId]);
  res.json({ capacity, seats: bookings.rows });
});

module.exports = router;