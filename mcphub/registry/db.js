const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'mcphub.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      git_url TEXT NOT NULL,
      description TEXT,
      current_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS server_categories (
      server_id INTEGER,
      category_id INTEGER,
      FOREIGN KEY(server_id) REFERENCES servers(id),
      FOREIGN KEY(category_id) REFERENCES categories(id),
      PRIMARY KEY(server_id, category_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      total_score INTEGER,
      breakdown_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(server_id) REFERENCES servers(id)
    )
  `);

  // Seed initial categories
  const categories = ['Utility', 'AI', 'Data', 'Communication', 'Development'];
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  categories.forEach(cat => insertCategory.run(cat));
  insertCategory.finalize();
});

module.exports = db;
