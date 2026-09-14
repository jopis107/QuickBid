// Uvoz potrebnih biblioteka i middlewarea
const express = require('express');
const db = require('../db');
const upload = require('../utils/upload');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Eksportiramo tvorničku funkciju koja prima Socket.io poslužitelj (io)
module.exports = function itemsRouter(io) {
  const router = express.Router();

  // Pripremljeni SQL upiti za rad s predmetima i ponudama
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

  // SQL upiti za nadmetanje (licitiranje)
  const insertBid = db.prepare(
    'INSERT INTO bids (item_id, user_id, amount) VALUES (?, ?, ?)'
  );

  const bumpPrice = db.prepare('UPDATE items SET current_price = ? WHERE id = ?');

  const getBidsForItem = db.prepare(`
    SELECT bids.*, u.username FROM bids
    JOIN users u ON u.id = bids.user_id
    WHERE item_id = ? ORDER BY bids.created_at DESC LIMIT 25
  `);

  const getRankedBidders = db.prepare(`
    SELECT bids.user_id, MAX(bids.amount) AS amount, u.username, u.email
    FROM bids JOIN users u ON u.id = bids.user_id
    WHERE bids.item_id = ?
    GROUP BY bids.user_id
    ORDER BY amount DESC
  `);

  // GET /api/items - Javni katalog
  router.get('/', (req, res) => {
    const items = listItems.all();
    res.json({ items });
  });

  // GET /api/items/currency/convert - Tečaj valuta s vanjskog API-ja
  router.get('/currency/convert', optionalAuth, async (req, res) => {
    const { amount = 1, from = 'EUR', to = 'USD' } = req.query;
    try {
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

  // GET /api/items/:id - Dohvat predmeta zajedno s poviješću ponuda i rang listom
  router.get('/:id', (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    const bids = getBidsForItem.all(item.id);
    const rankedBidders = getRankedBidders.all(item.id).slice(0, 3);
    res.json({ item, bids, rankedBidders });
  });

  // POST /api/items - Kreiranje novog predmeta
  router.post('/', requireAuth, upload.single('image'), (req, res) => {
    const { title, description, starting_price, currency, duration_minutes } = req.body;
    if (!title || !description || !starting_price) {
      return res.status(400).json({ error: 'Naziv, opis i početna cijena su obavezni.' });
    }
    const price = parseFloat(starting_price);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Početna cijena mora biti pozitivan broj.' });
    }

    const minutes = parseInt(duration_minutes, 10) || 60;
    const endsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

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

  // POST /api/items/:id/bid - Licitiranje u stvarnom vremenu s emitiranjem preko Socketa
  router.post('/:id/bid', requireAuth, (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    if (item.status !== 'active') {
      return res.status(400).json({ error: 'Aukcija ne prima nove ponude.' });
    }
    if (new Date(item.ends_at) < new Date()) {
      return res.status(400).json({ error: 'Vrijeme za nadmetanje je isteklo.' });
    }
    if (item.owner_id === req.user.id) {
      return res.status(400).json({ error: 'Ne možete licitirati na vlastiti predmet.' });
    }

    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount <= item.current_price) {
      return res.status(400).json({
        error: `Ponuda mora biti veća od trenutne cijene (${item.current_price}).`
      });
    }

    // Unos nove ponude i podizanje cijene u bazi
    insertBid.run(item.id, req.user.id, amount);
    bumpPrice.run(amount, item.id);

    const updatedItem = getItem.get(item.id);
    const bids = getBidsForItem.all(item.id);

    // Emitiranje nove ponude svim korisnicima u sobi ove aukcije uživo
    io.to(`item_${item.id}`).emit('bid:update', {
      itemId: item.id,
      current_price: updatedItem.current_price,
      bids
    });

    res.status(201).json({ item: updatedItem, bids });
  });

  // PUT /api/items/:id - Uređivanje predmeta
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

  // DELETE /api/items/:id - Brisanje predmeta
  router.delete('/:id', requireAuth, (req, res) => {
    const existing = getItem.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    if (existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Nemate ovlasti za brisanje ove aukcije.' });
    }

    deleteItemStmt.run(req.params.id, req.user.id);
    res.json({ message: 'Aukcija je obrisana.' });
  });

  return router;
};