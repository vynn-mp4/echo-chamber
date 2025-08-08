const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('./echo_chamber.db');

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Default user: change 'yourname' and 'yoursecretpassword' later
  db.run(
    `INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`,
    ['yourname', 'yoursecretpassword']
  );
});

// POST: Submit a message
app.post('/:username', (req, res) => {
  const { username } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  db.get('SELECT 1 FROM users WHERE username = ?', [username], (err, row) => {
    if (!row) return res.status(404).json({ error: 'User not found' });

    // Wrap the insert in a retry loop
function insertSuggestion(username, message, callback) {
  const stmt = db.prepare('INSERT INTO suggestions (username, message) VALUES (?, ?)');
  
  const tryRun = () => {
    stmt.run(username, message, function (err) {
      if (err) {
        if (err.code === 'SQLITE_BUSY') {
          console.log('Database busy, retrying...');
          setTimeout(tryRun, 100); // Try again after 100ms
        } else {
          callback(err);
        }
      } else {
        callback(null, this.lastID);
      }
    });
  };

  tryRun();
}

// Use it in your route
app.post('/:username', (req, res) => {
  const { username } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  db.get('SELECT 1 FROM users WHERE username = ?', [username], (err, row) => {
    if (!row) return res.status(404).json({ error: 'User not found' });

    insertSuggestion(username, message.trim(), (err, id) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Save failed' });
      }
      res.json({ id });
    });
  });
});
  });
});

// GET: Admin view messages
app.get('/admin/:username', (req, res) => {
  const { username } = req.params;
  const { password } = req.query;

  db.get('SELECT password FROM users WHERE username = ?', [username], (err, user) => {
    if (!user || user.password !== password) {
      return res.status(403).json({ error: 'Invalid password' });
    }

    db.all('SELECT * FROM suggestions WHERE username = ? ORDER BY timestamp DESC', [username], (err, rows) => {
      res.json(rows || []);
    });
  });
});

// DELETE: Remove a message
app.delete('/suggestion/:id', (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;

  db.get('SELECT password FROM users WHERE username = ?', [username], (err, user) => {
    if (!user || user.password !== password) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.run('DELETE FROM suggestions WHERE id = ?', [id], function (err) {
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted' });
    });
  });
});

// Static files (frontend) — ignore for now
app.use(express.static(path.join(__dirname, '..')));

// Serve the frontend for any username
app.get('/:username', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// GET: All suggestions (for dashboard)
app.get('/api/suggestions', (req, res) => {
  db.all('SELECT * FROM suggestions ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// DELETE: Remove a suggestion
app.delete('/api/suggestions/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM suggestions WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Delete failed' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    res.json({ message: 'Deleted successfully' });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Echo Chamber backend running on http://localhost:${PORT}`);
});