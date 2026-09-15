const express = require('express');
const db = require('../db');
const upload = require('../utils/upload');
const uploadProof = require('../utils/uploadProof');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { streamReceipt } = require('../utils/receipt');

// Rok za uplatu, 7 dana u milisekundama
const PAYMENT_WINDOW_MS =
  (parseFloat(process.env.PAYMENT_WINDOW_DAYS) || 7) * 24 * 60 * 60 * 1000;
const MAX_PAYMENT_RANK = 3;

module.exports = function itemsRouter(io) {
  const router = express.Router();

  const insertItem = db.prepare(`
    INSERT INTO items (title, description, starting_price, current_price, currency, image_path, owner_id, ends_at, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const getItem = db.prepare(`
    SELECT items.*, u.username AS owner_username
    FROM items JOIN users u ON u.id = items.owner_id
    WHERE items.id = ?`);
  const listItems = db.prepare(`
    SELECT items.*, u.username AS owner_username
    FROM items JOIN users u ON u.id = items.owner_id
    ORDER BY items.created_at DESC`);
  const updateItemStmt = db.prepare(`
    UPDATE items SET title = ?, description = ?, currency = ?, image_path = ?
    WHERE id = ? AND owner_id = ?`);
  const deleteItemStmt = db.prepare('DELETE FROM items WHERE id = ? AND owner_id = ?');
  const insertBid = db.prepare(
    'INSERT INTO bids (item_id, user_id, amount) VALUES (?, ?, ?)');
  const bumpPrice = db.prepare('UPDATE items SET current_price = ? WHERE id = ?');
  const getBidsForItem = db.prepare(`
    SELECT bids.*, u.username FROM bids
    JOIN users u ON u.id = bids.user_id
    WHERE item_id = ? ORDER BY bids.created_at DESC LIMIT 25`);
  const getRankedBidders = db.prepare(`
    SELECT bids.user_id, MAX(bids.amount) AS amount, u.username, u.email
    FROM bids JOIN users u ON u.id = bids.user_id
    WHERE bids.item_id = ?
    GROUP BY bids.user_id
    ORDER BY amount DESC`);
  const getUserById = db.prepare('SELECT id, username, email FROM users WHERE id = ?');
  const getActiveItems = db.prepare("SELECT * FROM items WHERE status = 'active'");
  const getAwaitingPaymentItems = db.prepare(
    "SELECT * FROM items WHERE status = 'awaiting_payment'");

  const setAwaitingPayment = db.prepare(`
    UPDATE items
    SET status = 'awaiting_payment', winner_id = ?, payment_rank = ?, payment_deadline = ?, payment_proof_path = NULL
    WHERE id = ?`);
  const setFailed = db.prepare(`
    UPDATE items SET status = 'failed', payment_deadline = NULL WHERE id = ?`);
  const setCompleted = db.prepare(`
    UPDATE items SET status = 'completed', payment_proof_path = ? WHERE id = ?`);
  const restartItem = db.prepare(`
    UPDATE items
    SET status = 'active', current_price = starting_price, winner_id = NULL,
        payment_rank = NULL, payment_deadline = NULL, payment_proof_path = NULL,
        ends_at = ?, duration_minutes = ?
    WHERE id = ?`);
  const deleteBidsForItem = db.prepare('DELETE FROM bids WHERE item_id = ?');
  const insertNotification = db.prepare(
    'INSERT INTO notifications (user_id, item_id, type, message) VALUES (?, ?, ?, ?)');

  // Slanje notifikacije u bazu i preko socketa uživo korisniku
  function notify(userId, itemId, type, message) {
    insertNotification.run(userId, itemId, type, message);
    io.to(`user_${userId}`).emit('notification:new', { itemId, type, message });
  }

  function broadcastStatusChange(itemId) {
    const updatedItem = getItem.get(itemId);
    io.to(`item_${itemId}`).emit('auction:status_changed', { itemId, item: updatedItem });
    return updatedItem;
  }

  // Dodjeljuje priliku za uplatu sljedećem rangiranom ponuditelju
  function assignPaymentRank(itemId, rank, rankedBidders) {
    const bidder = rankedBidders[rank - 1];
    const deadline = new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString();
    setAwaitingPayment.run(bidder.user_id, rank, deadline, itemId);
    const item = getItem.get(itemId);
    notify(
      bidder.user_id,
      itemId,
      'payment_turn',
      `Osvojili ste priliku kupiti "${item.title}" (${rank}. mjesto na listi ponuda). Imate 5 dana za preuzimanje računa i upload potvrde o uplati.`
    );
    return broadcastStatusChange(itemId);
  }

  // Pokreće proces naplate nakon isteka aukcije
  function beginPaymentCascade(itemId) {
    const ranked = getRankedBidders.all(itemId);
    if (ranked.length === 0) {
      setFailed.run(itemId);
      const item = getItem.get(itemId);
      notify(
        item.owner_id,
        itemId,
        'payment_failed',
        `Aukcija "${item.title}" je završila bez ijedne ponude. Transakcija nije izvršena — možete ponovno pokrenuti aukciju.`
      );
      return broadcastStatusChange(itemId);
    }
    return assignPaymentRank(itemId, 1, ranked);
  }

  // Prebacuje pravo kupnje na idućeg ponuditelja ako trenutni propusti rok
  function advanceOrFailCascade(item) {
    const ranked = getRankedBidders.all(item.id);
    const nextRank = item.payment_rank + 1;
    if (nextRank <= MAX_PAYMENT_RANK && ranked[nextRank - 1]) {
      return assignPaymentRank(item.id, nextRank, ranked);
    }
    setFailed.run(item.id);
    notify(
      item.owner_id,
      item.id,
      'payment_failed',
      `Nijedan od ponuditelja nije izvršio uplatu za "${item.title}" u zadanom roku. Transakcija nije izvršena — možete ponovno pokrenuti aukciju.`
    );
    return broadcastStatusChange(item.id);
  }

  // Pozadinski čistač isteklih aukcija
  function closeExpiredAuctions() {
    const now = Date.now();
    const expired = getActiveItems.all().filter((item) => new Date(item.ends_at).getTime() <= now);
    for (const item of expired) {
      beginPaymentCascade(item.id);
    }
    return expired.length;
  }

  // Pozadinski čistač isteklih rokova za uplatu
  function sweepPaymentDeadlines() {
    const now = Date.now();
    const awaiting = getAwaitingPaymentItems
      .all()
      .filter((item) => item.payment_deadline && new Date(item.payment_deadline).getTime() <= now);
    for (const item of awaiting) {
      advanceOrFailCascade(item);
    }
    return awaiting.length;
  }

  // GET /api/items - popis predmeta
  router.get('/', (req, res) => {
    const items = listItems.all();
    res.json({ items });
  });

  // GET /api/items/:id - detalji predmeta
  router.get('/:id', (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    const bids = getBidsForItem.all(item.id);
    const rankedBidders = getRankedBidders.all(item.id).slice(0, MAX_PAYMENT_RANK);
    res.json({ item, bids, rankedBidders });
  });

  // POST /api/items - objava novog predmeta
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

  // PUT /api/items/:id - izmjena predmeta
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

  // DELETE /api/items/:id - brisanje predmeta
  router.delete('/:id', requireAuth, (req, res) => {
    const existing = getItem.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    if (existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Nemate ovlasti za brisanje ove aukcije.' });
    }
    deleteItemStmt.run(req.params.id, req.user.id);
    res.json({ message: 'Aukcija je obrisana.' });
  });

  // POST /api/items/:id/bid - licitiranje
  router.post('/:id/bid', requireAuth, (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    if (item.status !== 'active') {
      return res.status(400).json({ error: 'Aukcija ne prima nove ponude.' });
    }
    if (new Date(item.ends_at) < new Date()) {
      beginPaymentCascade(item.id);
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

    insertBid.run(item.id, req.user.id, amount);
    bumpPrice.run(amount, item.id);
    const updatedItem = getItem.get(item.id);
    const bids = getBidsForItem.all(item.id);

    io.to(`item_${item.id}`).emit('bid:update', {
      itemId: item.id,
      current_price: updatedItem.current_price,
      bids
    });

    res.status(201).json({ item: updatedItem, bids });
  });

  // POST /api/items/:id/end - ručno zatvaranje aukcije
  router.post('/:id/end', requireAuth, (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    if (item.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Samo vlasnik može zatvoriti aukciju.' });
    }
    if (item.status !== 'active') {
      return res.status(400).json({ error: 'Aukcija je već završena.' });
    }
    const updatedItem = beginPaymentCascade(item.id);
    res.json({ item: updatedItem });
  });

  // POST /api/items/:id/payment-proof - slanje potvrde plaćanja
  router.post('/:id/payment-proof', requireAuth, uploadProof.single('proof'), (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    if (item.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'Aukcija trenutno ne čeka potvrdu o uplati.' });
    }
    if (item.winner_id !== req.user.id) {
      return res.status(403).json({ error: 'Trenutno niste vi na redu za uplatu.' });
    }
    if (new Date(item.payment_deadline) < new Date()) {
      return res.status(400).json({ error: 'Rok za uplatu je istekao.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Potrebno je priložiti potvrdu o uplati (slika ili PDF).' });
    }

    const proofPath = `/uploads/${req.file.filename}`;
    setCompleted.run(proofPath, item.id);
    notify(
      item.owner_id,
      item.id,
      'payment_completed',
      `Kupac je uplatio za "${item.title}". Aukcija je uspješno zaključena.`
    );
    const updatedItem = broadcastStatusChange(item.id);
    res.json({ item: updatedItem });
  });

  // POST /api/items/:id/restart - ponovno pokretanje neuspjele aukcije
  router.post('/:id/restart', requireAuth, (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    if (item.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Samo vlasnik može ponovno pokrenuti aukciju.' });
    }
    if (item.status !== 'failed') {
      return res.status(400).json({ error: 'Samo neuspjele aukcije mogu biti ponovno pokrenute.' });
    }
    const minutes = parseInt(req.body.duration_minutes, 10) || item.duration_minutes || 60;
    const endsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    deleteBidsForItem.run(item.id);
    restartItem.run(endsAt, minutes, item.id);
    const updatedItem = broadcastStatusChange(item.id);
    res.json({ item: updatedItem });
  });

  // GET /api/items/:id/receipt - preuzimanje PDF računa
  router.get('/:id/receipt', requireAuth, (req, res) => {
    const item = getItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Aukcija nije pronađena.' });
    const eligibleStatus = item.status === 'awaiting_payment' || item.status === 'completed';
    if (!eligibleStatus || item.winner_id !== req.user.id) {
      return res.status(403).json({ error: 'Račun je dostupan samo trenutno rangiranom kupcu.' });
    }
    const winner = getUserById.get(req.user.id);
    streamReceipt(res, {
      item,
      winner,
      amount: item.current_price,
      currency: item.currency
    });
  });

  // GET /api/items/currency/convert - tečaj
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

  router.closeExpiredAuctions = closeExpiredAuctions;
  router.sweepPaymentDeadlines = sweepPaymentDeadlines;

  return router;
};