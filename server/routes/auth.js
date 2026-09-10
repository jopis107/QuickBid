const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

const insertUser = db.prepare(
  'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
);
const findByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Sva polja su obavezna.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Lozinka mora imati najmanje 6 znakova.' });
  }
  if (findByUsername.get(username)) {
    return res.status(409).json({ error: 'Korisničko ime je zauzeto.' });
  }
  if (findByEmail.get(email)) {
    return res.status(409).json({ error: 'Email je već registriran.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const info = insertUser.run(username, email, hash);
  const user = { id: info.lastInsertRowid, username, email };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Korisničko ime i lozinka su obavezni.' });
  }
  const user = findByUsername.get(username);
  if (!user) {
    return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka.' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka.' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email }
  });
});

module.exports = router;