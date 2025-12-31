import { randomUUID } from 'node:crypto';

export function ensureWallet(db, userId) {
  db.prepare('INSERT OR IGNORE INTO wallets (user_id, credits, pass_expires_at) VALUES (?, 0, NULL)').run(userId);
}

export function getWallet(db, userId) {
  ensureWallet(db, userId);
  return db.prepare('SELECT user_id, credits, pass_expires_at FROM wallets WHERE user_id = ?').get(userId);
}

/**
 * Checks if the user has an active play pass.
 * @param {object} wallet - Wallet object with pass_expires_at
 * @returns {boolean} - True if pass is active
 */
export function hasActivePass(wallet) {
  if (!wallet?.pass_expires_at) return false;
  return new Date(wallet.pass_expires_at) > new Date();
}

/**
 * Atomically consumes one credit from the user's wallet.
 * Returns true if credit was consumed, false if insufficient credits.
 * @param {object} db - Database instance
 * @param {string} userId - User ID
 * @returns {boolean} - True if credit consumed
 */
export function consumeCredit(db, userId) {
  ensureWallet(db, userId);
  const result = db.prepare('UPDATE wallets SET credits = credits - 1 WHERE user_id = ? AND credits >= 1').run(userId);
  return result.changes > 0;
}

/**
 * Records a play transaction in the transactions table.
 * @param {object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} gameId - Game ID
 * @param {string} mode - 'credit' or 'pass'
 * @param {string} playToken - The play session token
 */
export function recordPlayTransaction(db, userId, gameId, mode, playToken) {
  const now = new Date().toISOString();
  const txId = randomUUID();
  const deltaCredits = mode === 'credit' ? -1 : 0;
  const meta = { game_id: gameId, play_token: playToken, mode };
  db.prepare(
    'INSERT INTO transactions (tx_id, user_id, kind, sku, delta_credits, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(txId, userId, 'play', null, deltaCredits, JSON.stringify(meta), now);
}

export function grantForSku(db, userId, sku, catalogItem, meta) {
  const now = new Date().toISOString();
  ensureWallet(db, userId);

  const txId = randomUUID();
  const deltaCredits = Number(catalogItem.grantCredits || 0);

  // Apply credits
  if (deltaCredits > 0) {
    db.prepare('UPDATE wallets SET credits = credits + ? WHERE user_id = ?').run(deltaCredits, userId);
  }

  // Apply pass
  if (catalogItem.passMinutes && Number(catalogItem.passMinutes) > 0) {
    const minutes = Number(catalogItem.passMinutes);
    const current = db.prepare('SELECT pass_expires_at FROM wallets WHERE user_id = ?').get(userId)?.pass_expires_at;
    const base = current ? new Date(current) : new Date();
    const start = base > new Date() ? base : new Date();
    const expires = new Date(start.getTime() + minutes * 60_000).toISOString();
    db.prepare('UPDATE wallets SET pass_expires_at = ? WHERE user_id = ?').run(expires, userId);
  }

  db.prepare(
    'INSERT INTO transactions (tx_id, user_id, kind, sku, delta_credits, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(txId, userId, 'purchase', sku, deltaCredits, JSON.stringify(meta || {}), now);

  return getWallet(db, userId);
}
