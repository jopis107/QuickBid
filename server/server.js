require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Montiranje ruta za autentikaciju i korisnike
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Centralni error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Interna pogreška poslužitelja.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`QuickBid server sluša na http://localhost:${PORT}`);
});