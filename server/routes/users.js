const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const getUserById = db.prepare(
  'SELECT id, username, email, created_at FROM users WHERE id = ?'
);
const updateUser = db.prepare(
  'UPDATE users SET username = ?, email = ? WHERE id = ?'
);
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
const findByUsername = db.prepare('SELECT * FROM users WHERE username = ? AND id != ?');
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ? AND id != ?');
const getCompletedWins = db.prepare(`
  SELECT items.*, u.username AS owner_username
  FROM items
  JOIN users u ON u.id = items.owner_id
  WHERE items.winner_id = ? AND items.status = 'completed'
  ORDER BY items.ends_at DESC
`);
const getPendingPayments = db.prepare(`
  SELECT items.*, u.username AS owner_username
  FROM items
  JOIN users u ON u.id = items.owner_id
  WHERE items.winner_id = ? AND items.status = 'awaiting_payment'
  ORDER BY items.payment_deadline ASC
`);
const getMyListings = db.prepare(
  'SELECT * FROM items WHERE owner_id = ? ORDER BY created_at DESC'
);

// READ - trenutačni profil
router.get('/me', requireAuth, (req, res) => {
  const user = getUserById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Korisnik nije pronađen.' });
  const wins = getCompletedWins.all(req.user.id);
  const pendingPayments = getPendingPayments.all(req.user.id);
  const listings = getMyListings.all(req.user.id);
  res.json({ user, wins, pendingPayments, listings });
});

// UPDATE - profil
router.put('/me', requireAuth, (req, res) => {
  const { username, email, password } = req.body;
  const current = getUserById.get(req.user.id);
  if (!current) return res.status(404).json({ error: 'Korisnik nije pronađen.' });

  const newUsername = username || current.username;
  const newEmail = email || current.email;

  if (findByUsername.get(newUsername, req.user.id)) {
    return res.status(409).json({ error: 'Korisničko ime je zauzeto.' });
  }
  if (findByEmail.get(newEmail, req.user.id)) {
    return res.status(409).json({ error: 'Email je već u upotrebi.' });
  }

  updateUser.run(newUsername, newEmail, req.user.id);

  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'Lozinka mora imati najmanje 6 znakova.' });
    }
    bcrypt.hash(password, 10).then((hash) => {
      updatePassword.run(hash, req.user.id);
      res.json({ user: getUserById.get(req.user.id) });
    });
  } else {
    res.json({ user: getUserById.get(req.user.id) });
  }
});

// DELETE - profil
router.delete('/me', requireAuth, (req, res) => {
  deleteUser.run(req.user.id);
  res.json({ message: 'Korisnički račun je obrisan.' });
});

// READ - javni profil
router.get('/:id', (req, res) => {
  const user = getUserById.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Korisnik nije pronađen.' });
  const wins = getCompletedWins.all(req.params.id);
  res.json({ user, wins });
});

module.exports = router;