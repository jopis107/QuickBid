// Uvoz radnog okvira i pomoćnih modula
const express = require('express');
const db = require('../db');
const upload = require('../utils/upload');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Pripremljeni SQL upiti (PreparedStatement) za brže i sigurnije izvršavanje
const insertItem = db.prepare(`
  INSERT INTO items (title, description, starting_price, current_price, currency, image_path, owner_id, ends_at, duration_minutes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getItem = db.prepare(`
  SELECT items.*, u.username AS owner_username
  FROM items JOIN users u ON u.id = items.owner_id
  WHERE items.id = ?
`);

const listItems = db.prepare(`
  SELECT items.*, u.username AS owner_username
  FROM items JOIN users u ON u.id = items.owner_id
  ORDER BY items.created_at DESC
`);

const updateItemStmt = db.prepare(`
  UPDATE items SET title = ?, description = ?, currency = ?, image_path = ?
  WHERE id = ? AND owner_id = ?
`);

const deleteItemStmt = db.prepare('DELETE FROM items WHERE id = ? AND owner_id = ?');

// GET /api/items - Javni katalog svih predmeta
router.get('/', (req, res) => {
  const items = listItems.all();
  res.json({ items });
});

// GET /api/items/currency/convert - Poziv vanjskog tečajnog API-ja (frankfurter.app)
router.get('/currency/convert', optionalAuth, async (req, res) => {
  const { amount = 1, from = 'EUR', to = 'USD' } = req.query;
  try {
    // Koristimo globalni fetch koji je nativan u modernom Node.js-u
    const response = await fetch(
      `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`
    );
    if (!response.ok) throw new Error('Tečajni API nije dostupan.');
    const data = await response.json();
    res.json({ amount: parseFloat(amount), from, to, result: data.rates[to] });
  } catch (err) {
    res.status(502).json({ error: 'Greška pri dohvaćanju tečaja.', details: err.message });
  }
});

// GET /api/items/:id - Dohvat pojedinog predmeta po ID-u
router.get('/:id', (req, res) => {
  const item = getItem.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
  res.json({ item });
});

// POST /api/items - Kreiranje novog aukcijskog predmeta (autorizacija + upload slike)
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  const { title, description, starting_price, currency, duration_minutes } = req.body;
  
  // Validacija obaveznih polja
  if (!title || !description || !starting_price) {
    return res.status(400).json({ error: 'Naziv, opis i početna cijena su obavezni.' });
  }
  
  const price = parseFloat(starting_price);
  if (isNaN(price) || price <= 0) {
    return res.status(400).json({ error: 'Početna cijena mora biti pozitivan broj.' });
  }

  // Izračun vremena isteka aukcije
  const minutes = parseInt(duration_minutes, 10) || 60;
  const endsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  // Unos u bazu podataka
  const info = insertItem.run(
    title,
    description,
    price,
    price,
    currency || 'EUR',
    imagePath,
    req.user.id,
    endsAt,
    minutes
  );

  const item = getItem.get(info.lastInsertRowid);
  res.status(201).json({ item });
});

// PUT /api/items/:id - Uređivanje predmeta (samo vlasnik)
router.put('/:id', requireAuth, upload.single('image'), (req, res) => {
  const existing = getItem.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
  if (existing.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Nemate ovlasti za uređivanje ove aukcije.' });
  }

  const title = req.body.title || existing.title;
  const description = req.body.description || existing.description;
  const currency = req.body.currency || existing.currency;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : existing.image_path;

  updateItemStmt.run(title, description, currency, imagePath, req.params.id, req.user.id);
  res.json({ item: getItem.get(req.params.id) });
});

// DELETE /api/items/:id - Brisanje predmeta (samo vlasnik)
router.delete('/:id', requireAuth, (req, res) => {
  const existing = getItem.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
  if (existing.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Nemate ovlasti za brisanje ove aukcije.' });
  }

  deleteItemStmt.run(req.params.id, req.user.id);
  res.json({ message: 'Aukcija je obrisana.' });
});

module.exports = router;