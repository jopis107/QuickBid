// Uvoz sqlite baze i biblioteke za putanje
const Database = require('better-sqlite3');
const path = require('path');

// Putanja do lokalne SQLite datoteke
const dbPath = path.join(__dirname, 'quickbid.sqlite');
const db = new Database(dbPath);

// Uključivanje prisilne provjere stranih ključeva (referencijalni integritet)
db.pragma('foreign_keys = ON');

// Kreiranje relacijskih tablica ako već ne postoje
db.exec(`
  -- Tablica korisnika (autentikacija)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tablica aukcijskih predmeta
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    starting_price REAL NOT NULL,
    current_price REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    image_path TEXT,
    owner_id INTEGER NOT NULL,
    winner_id INTEGER,
    status TEXT DEFAULT 'active',
    payment_rank INTEGER,
    payment_deadline DATETIME,
    payment_proof_path TEXT,
    duration_minutes INTEGER DEFAULT 60,
    ends_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Tablica ponuda (bids)
  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

module.exports = db;