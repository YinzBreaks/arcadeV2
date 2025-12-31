import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function openDb() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'arcadeV2.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      amount_usd TEXT NOT NULL,
      coinbase_charge_id TEXT UNIQUE,
      coinbase_code TEXT UNIQUE,
      hosted_url TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      fulfilled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY,
      credits INTEGER NOT NULL DEFAULT 0,
      pass_expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      tx_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      sku TEXT,
      delta_credits INTEGER NOT NULL DEFAULT 0,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS play_sessions (
      play_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return db;
}
