const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const getUserById = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
const getListings = db.prepare('SELECT * FROM items WHERE owner_id = ? ORDER BY created_at DESC');
const getPendingPayments = db.prepare(
  "SELECT * FROM items WHERE status = 'awaiting_payment' AND winner_id = ? ORDER BY payment_deadline ASC"
);
const getWins = db.prepare(
  "SELECT * FROM items WHERE status = 'completed' AND winner_id = ? ORDER BY created_at DESC"
);

// GET /api/users/me - podaci za stranicu profila
router.get('/me', requireAuth, (req, res) => {
  const user = getUserById.get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Korisnik nije pronađen.' });
  }

  const listings = getListings.all(req.user.id);
  const pendingPayments = getPendingPayments.all(req.user.id);
  const wins = getWins.all(req.user.id);

  res.json({
    user,
    listings,
    pendingPayments,
    wins
  });
});

module.exports = router;