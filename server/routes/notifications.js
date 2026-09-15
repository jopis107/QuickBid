// Uvoz Expressa i baze podataka
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// SQL upiti za dohvat i ažuriranje statusa obavijesti
const listNotifications = db.prepare(
  'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
);
const markRead = db.prepare(
  'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
);
const markAllRead = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?');

// GET /api/notifications - Popis obavijesti prijavljenog korisnika
router.get('/', requireAuth, (req, res) => {
  res.json({ notifications: listNotifications.all(req.user.id) });
});

// POST /api/notifications/:id/read - Označavanje pojedinačne obavijesti pročitanom
router.post('/:id/read', requireAuth, (req, res) => {
  markRead.run(req.params.id, req.user.id);
  res.json({ message: 'Obavijest označena kao pročitana.' });
});

// POST /api/notifications/read-all - Označavanje svih obavijesti pročitanima
router.post('/read-all', requireAuth, (req, res) => {
  markAllRead.run(req.user.id);
  res.json({ message: 'Sve obavijesti su označene kao pročitane.' });
});

module.exports = router;