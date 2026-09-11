// Učitavanje varijabli iz .env datoteke
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Uvoz definiranih ruta
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const itemsRoutes = require('./routes/items');

const app = express();

// Konfiguracija CORS-a za komunikaciju s React klijentom
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));

// Parsiranje dolaznog JSON formata
app.use(express.json());

// Statičko posluživanje uploadanih slika iz mape /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Montiranje REST API ruta
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/items', itemsRoutes);

// Health check ruta
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Centralni error handler za hvatanje grešaka
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Interna pogreška poslužitelja.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`QuickBid server sluša na http://localhost:${PORT}`);
});