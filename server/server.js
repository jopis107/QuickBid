require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const itemsRoutesFactory = require('./routes/items');
const notificationsRoutes = require('./routes/notifications');
const registerSocketHandlers = require('./sockets/index');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const itemsRouter = itemsRoutesFactory(io);

// Montiranje svih API ruta
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/items', itemsRouter);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Centralni error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Interna pogreška poslužitelja.' });
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`QuickBid server sluša na http://localhost:${PORT}`);

  // Pozadinski posao za provjeru isteklih aukcija i rokova plaćanja
  function runBackgroundSweep() {
    try {
      const closedCount = itemsRouter.closeExpiredAuctions();
      if (closedCount > 0) {
        console.log(`Pokrenut ciklus plaćanja za isteklih aukcija: ${closedCount}`);
      }
      const advancedCount = itemsRouter.sweepPaymentDeadlines();
      if (advancedCount > 0) {
        console.log(`Obrađeno isteklih rokova za uplatu: ${advancedCount}`);
      }
    } catch (err) {
      console.error('Greška pri pozadinskoj obradi aukcija:', err);
    }
  }

  function gracefulShutdown() {
    try {
      db.close();
    } catch (e) {}
    process.exit(0);
  }

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGUSR2', gracefulShutdown); // Signal koji nodemon šalje kod restarta

  runBackgroundSweep();
  setInterval(runBackgroundSweep, 7000);
});