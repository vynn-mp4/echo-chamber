const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..')));

// Database
const db = new sqlite3.Database('./echo_chamber.db');

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  // Insert default council member (change email/password!)
  db.run(
    `INSERT OR IGNORE INTO admins (email, password) VALUES (?, ?)`,
    ['studentcouncil@yourschool.edu', 'S3cr3tC0unc1l!']
  );
});

// POST: Submit suggestion
app.post('/api/suggest', (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const stmt = db.prepare('INSERT INTO suggestions (message) VALUES (?)');
  stmt.run(message.trim(), function (err) {
    if (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: 'Save failed' });
    }
    res.json({ id: this.lastID });
  });
  stmt.finalize();
});

// POST: Admin Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT 1 FROM admins WHERE email = ? AND password = ?', [email, password], (err, row) => {
    if (!row) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    res.json({ success: true });
  });
});

// GET: All suggestions (protected by password)
app.get('/api/suggestions', (req, res) => {
  const password = req.headers['x-admin-pass'] || req.query.admin_pass;

  db.get('SELECT 1 FROM admins WHERE password = ?', [password], (err, row) => {
    if (!row) return res.status(403).json({ error: 'Unauthorized' });

    db.all('SELECT * FROM suggestions ORDER BY timestamp DESC', [], (err, rows) => {
      res.json(rows || []);
    });
  });
});

// DELETE: Remove suggestion
app.delete('/api/suggestions/:id', (req, res) => {
  const { id } = req.params;
  const password = req.body.password;

  db.get('SELECT 1 FROM admins WHERE password = ?', [password], (err, row) => {
    if (!row) return res.status(403).json({ error: 'Unauthorized' });

    db.run('DELETE FROM suggestions WHERE id = ?', [id], function (err) {
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted' });
    });
  });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Echo Chamber backend running on http://localhost:${PORT}`);
});