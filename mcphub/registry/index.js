const express = require('express');
const cors = require('cors');
const db = require('./db');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));

// GET /api/servers - List all servers
app.get('/api/servers', (req, res) => {
  const { category, q } = req.query;
  let query = 'SELECT * FROM servers';
  const params = [];

  if (category || q) {
    query += ' WHERE';
    let conditions = [];
    if (category) {
      conditions.push(' id IN (SELECT server_id FROM server_categories WHERE category_id = (SELECT id FROM categories WHERE name = ?))');
      params.push(category);
    }
    if (q) {
      conditions.push(' (name LIKE ? OR description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    query += conditions.join(' AND');
  }

  query += ' ORDER BY current_score DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/servers/:id - Server detail + score history
app.get('/api/servers/:id', (req, res) => {
  db.get('SELECT * FROM servers WHERE id = ?', [req.params.id], (err, server) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!server) return res.status(404).json({ error: 'Server not found' });

    db.all('SELECT * FROM scores WHERE server_id = ? ORDER BY created_at DESC', [req.params.id], (err, scores) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`
        SELECT name FROM categories 
        JOIN server_categories ON categories.id = server_categories.category_id 
        WHERE server_categories.server_id = ?
      `, [req.params.id], (err, categories) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ...server, scores, categories: categories.map(c => c.name) });
      });
    });
  });
});

// POST /api/servers - Submit new MCP server
app.post('/api/servers', (req, res) => {
  const { name, git_url, description, categories } = req.body;
  
  if (!name || !git_url) {
    return res.status(400).json({ error: 'Name and Git URL are required' });
  }

  db.run(`
    INSERT INTO servers (name, git_url, description) 
    VALUES (?, ?, ?)
  `, [name, git_url, description || ''], function(err) {
    if (err) return res.status(400).json({ error: 'Server name already exists or invalid data' });
    
    const serverId = this.lastID;

    if (categories && Array.isArray(categories)) {
      categories.forEach(catName => {
        db.get('SELECT id FROM categories WHERE name = ?', [catName], (err, cat) => {
          if (cat) {
            db.run('INSERT INTO server_categories (server_id, category_id) VALUES (?, ?)', [serverId, cat.id]);
          }
        });
      });
    }

    res.status(201).json({ id: serverId, message: 'Server submitted and queued for scoring' });
  });
});

// POST /api/servers/:id/score - Trigger rescore
app.post('/api/servers/:id/score', (req, res) => {
  db.get('SELECT * FROM servers WHERE id = ?', [req.params.id], (err, server) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json({ message: 'Rescore triggered' });
  });
});

app.listen(port, () => {
  console.log(`Registry API running at http://localhost:${port}`);
});
