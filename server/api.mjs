import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { authenticateRequest } from './auth/supabase.mjs';
import { SKU_CATALOG } from './commerce/catalog.mjs';
import { createCharge } from './commerce/coinbase.mjs';
import { openDb } from './db.mjs';
import { getEnv } from './env.mjs';
import { getWallet } from './wallet.mjs';

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

try {
  await app.listen({ port: env.apiPort, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
