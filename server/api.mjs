import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { randomBytes, randomUUID } from 'node:crypto';
import { authenticateRequest } from './auth/supabase.mjs';
import { SKU_CATALOG } from './commerce/catalog.mjs';
import { createCharge } from './commerce/coinbase.mjs';
import { openDb } from './db.mjs';
import { getEnv } from './env.mjs';
import { consumeCredit, getWallet, hasActivePass, recordPlayTransaction } from './wallet.mjs';

// Play session duration in seconds (5 minutes)
const PLAY_SESSION_DURATION_SECONDS = 300;

const env = getEnv();
const db = openDb();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

app.get('/health', async () => ({ ok: true, service: 'api', ts: new Date().toISOString() }));

app.get('/wallet/me', async (req, reply) => {
  const userId = await authenticateRequest(req, reply);
  if (!userId) return; // Response already sent by authenticateRequest
  const w = getWallet(db, userId);
  return reply.send({
    ok: true,
    wallet: { credits: w.credits, passExpiresAt: w.pass_expires_at || null },
  });
});

app.post('/commerce/create-charge', async (req, reply) => {
  const userId = await authenticateRequest(req, reply);
  if (!userId) return; // Response already sent by authenticateRequest

  if (!env.coinbaseApiKey) {
    return reply.code(501).send({ ok: false, error: 'COINBASE_COMMERCE_API_KEY not set in .env.' });
  }

  const body = req.body || {};
  const sku = body.sku;
  if (typeof sku !== 'string')
    return reply.code(400).send({ ok: false, error: 'sku is required.' });

  const item = SKU_CATALOG[sku];
  if (!item) return reply.code(400).send({ ok: false, error: 'Unknown SKU.' });

  const orderId = randomUUID();
  const createdAt = new Date().toISOString();

  const payload = {
    pricing_type: 'fixed_price',
    local_price: { amount: item.usd, currency: 'USD' },
    metadata: { order_id: orderId, sku, user_id: userId },
    redirect_url: `${env.appOrigin}/kiosk?status=success&order_id=${encodeURIComponent(orderId)}`,
    cancel_url: `${env.appOrigin}/kiosk?status=cancel&order_id=${encodeURIComponent(orderId)}`,
  };

  try {
    const charge = await createCharge({ apiKey: env.coinbaseApiKey, payload });
    const hostedUrl = charge?.data?.hosted_url || charge?.hosted_url;
    const chargeId = charge?.data?.id || charge?.id;
    const code = charge?.data?.code || charge?.code;

    if (!hostedUrl || !chargeId) {
      req.log.error({ charge }, 'Coinbase response missing hosted_url or id');
      return reply
        .code(502)
        .send({ ok: false, error: 'Coinbase response missing hosted_url or id.' });
    }

    db.prepare(
      `INSERT INTO orders (order_id, user_id, sku, amount_usd, coinbase_charge_id, coinbase_code, hosted_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?)`,
    ).run(
      orderId,
      userId,
      sku,
      item.usd,
      String(chargeId),
      code ? String(code) : null,
      String(hostedUrl),
      createdAt,
      createdAt,
    );

    return reply.send({ ok: true, hostedUrl, orderId });
  } catch (err) {
    req.log.error(
      { err: err?.message, details: err?.details, status: err?.status },
      'Create charge failed',
    );
    return reply.code(502).send({ ok: false, error: err?.message || 'Create charge failed' });
  }
});

// ============================================================================
// PLAY SESSION ENDPOINTS
// ============================================================================

/**
 * POST /play/start
 * Starts a new play session. Atomically consumes credit or uses pass.
 * Returns a short-lived play token.
 */
app.post('/play/start', async (req, reply) => {
  const userId = await authenticateRequest(req, reply);
  if (!userId) return; // Response already sent

  const body = req.body || {};
  const gameId = body.gameId;

  if (typeof gameId !== 'string' || !gameId.trim()) {
    return reply.code(400).send({ ok: false, error: 'gameId is required.' });
  }

  // ENFORCE: User can only have ONE active play session at a time
  const now = new Date();
  const nowIso = now.toISOString();
  const existingSession = db
    .prepare('SELECT 1 FROM play_sessions WHERE user_id = ? AND expires_at > ? LIMIT 1')
    .get(userId, nowIso);

  if (existingSession) {
    return reply.code(409).send({ ok: false, error: 'ACTIVE_SESSION_EXISTS' });
  }

  const wallet = getWallet(db, userId);
  const expiresAt = new Date(now.getTime() + PLAY_SESSION_DURATION_SECONDS * 1000).toISOString();
  const createdAt = nowIso;

  // Determine play mode and authorize atomically
  let mode;

  // Use transaction for atomicity
  const tx = db.transaction(() => {
    // Check for active pass first
    if (hasActivePass(wallet)) {
      mode = 'pass';
    } else if (wallet.credits >= 1) {
      // Attempt to consume credit
      const consumed = consumeCredit(db, userId);
      if (!consumed) {
        // Race condition: credits were consumed between check and update
        return null;
      }
      mode = 'credit';
    } else {
      // Insufficient credits and no pass
      return null;
    }

    // Generate cryptographically random play token
    const playToken = randomBytes(24).toString('base64url');

    // Create play session record
    db.prepare(
      'INSERT INTO play_sessions (play_token, user_id, game_id, mode, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(playToken, userId, gameId.trim(), mode, expiresAt, createdAt);

    // Record transaction
    recordPlayTransaction(db, userId, gameId.trim(), mode, playToken);

    return { playToken, mode, expiresAt };
  });

  const result = tx();

  if (!result) {
    return reply.code(403).send({ ok: false, error: 'INSUFFICIENT_CREDITS' });
  }

  req.log.info({ userId, gameId, mode: result.mode, playToken: result.playToken }, 'Play session started');

  return reply.send({
    ok: true,
    playToken: result.playToken,
    mode: result.mode,
    expiresAt: result.expiresAt,
  });
});

/**
 * GET /play/verify
 * Verifies a play token is valid and not expired.
 */
app.get('/play/verify', async (req, reply) => {
  const token = req.query.token;

  if (typeof token !== 'string' || !token.trim()) {
    return reply.code(400).send({ ok: false, error: 'token query parameter is required.' });
  }

  const session = db.prepare('SELECT * FROM play_sessions WHERE play_token = ?').get(token.trim());

  if (!session) {
    return reply.send({ ok: false, error: 'INVALID_TOKEN' });
  }

  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  if (expiresAt <= now) {
    return reply.send({ ok: false, error: 'TOKEN_EXPIRED' });
  }

  return reply.send({
    ok: true,
    gameId: session.game_id,
    mode: session.mode,
    expiresAt: session.expires_at,
  });
});

try {
  await app.listen({ port: env.apiPort, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
