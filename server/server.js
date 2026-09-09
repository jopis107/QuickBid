import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Statičko serviranje uploadanih slika
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check ruta za provjeru rada servera
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'QuickBid poslužitelj je aktivan!',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 QuickBid server sluša na http://localhost:${PORT}`);
});