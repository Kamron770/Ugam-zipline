const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      slot TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      pay_method TEXT NOT NULL,
      used TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      paid_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS bookings_date ON bookings(date, slot);
    CREATE TABLE IF NOT EXISTS payme_tx (
      id TEXT PRIMARY KEY,
      booking_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      time INTEGER NOT NULL,
      state INTEGER NOT NULL,
      create_time INTEGER NOT NULL,
      perform_time INTEGER NOT NULL DEFAULT 0,
      cancel_time INTEGER NOT NULL DEFAULT 0,
      reason INTEGER
    );
    CREATE TABLE IF NOT EXISTS click_tx (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      click_trans_id TEXT NOT NULL,
      booking_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

module.exports = { open };
