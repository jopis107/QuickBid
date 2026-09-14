// Učitavanje varijabli okruženja
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

// Uvoz ruta i socket handlera
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const itemsRoutesFactory = require('./routes/items');
const registerSocketHandlers = require('./sockets/index');

const app = express();
// Kreiramo HTTP server koji omata Express aplikaciju
const server = http.createServer(app);

// Inicijalizacija Socket.io poslužitelja s CORS postavkama
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// Osnovni middleware
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Prosljeđujemo Socket.io instancu u rute za predmete
const itemsRouter = itemsRoutesFactory(io);

// Montiranje ruta
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/items', itemsRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Registracija websocket osluškivača soba
registerSocketHandlers(io);

// Centralni error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Interna pogreška poslužitelja.' });
});

const PORT = process.env.PORT || 4000;
// Slušamo na HTTP serveru (ne više na app) kako bi i Express i WebSockets radili na istom portu
server.listen(PORT, () => {
  console.log(`QuickBid server sluša na http://localhost:${PORT}`);
});