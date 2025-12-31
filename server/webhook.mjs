import Fastify from 'fastify';
import { SKU_CATALOG } from './commerce/catalog.mjs';
import { openDb } from './db.mjs';
import { getEnv } from './env.mjs';
import { hmacSha256Hex, timingSafeEqualHex } from './util/crypto.mjs';
import { grantForSku } from './wallet.mjs';

const env = getEnv();
const db = openDb();
const app = Fastify({ logger: true });

// Parse JSON as Buffer so we can verify signature against raw body.
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
  done(null, body),
);

app.get('/health', async () => ({ ok: true, service: 'webhook', ts: new Date().toISOString() }));

function findOrder({ orderId, chargeId, code }) {
  if (orderId) {
    const o = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
    if (o) return o;
  }
  if (chargeId) {
    const o = db.prepare('SELECT * FROM orders WHERE coinbase_charge_id = ?').get(String(chargeId));
    if (o) return o;
  }
  if (code) {
    const o = db.prepare('SELECT * FROM orders WHERE coinbase_code = ?').get(String(code));
    if (o) return o;
  }
  return null;
}

app.post('/commerce/webhook', async (req, reply) => {
  const sigHeader = req.headers['x-cc-webhook-signature'];
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody))
    return reply.code(400).send({ ok: false, error: 'Expected raw body Buffer.' });
  if (typeof sigHeader !== 'string')
    return reply.code(400).send({ ok: false, error: 'Missing X-CC-Webhook-Signature.' });
  if (!env.coinbaseWebhookSecret)
    return reply.code(501).send({ ok: false, error: 'Webhook secret not set.' });

  const computed = hmacSha256Hex(env.coinbaseWebhookSecret, rawBody);
  if (!timingSafeEqualHex(computed, sigHeader))
    return reply.code(401).send({ ok: false, error: 'Invalid signature.' });

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return reply.code(400).send({ ok: false, error: 'Invalid JSON.' });
  }

  const event = payload?.event || payload;
  const eventType = event?.type;
  const data = event?.data || {};
  const metadata = data?.metadata || {};
  const orderId = metadata?.order_id || null;

  const chargeId = data?.id || null;
  const code = data?.code || null;

  req.log.info({ eventType, orderId, chargeId, code }, 'Webhook verified');

  if (typeof eventType !== 'string') return reply.send({ ok: true });

  // Update order status always when possible
  const order = findOrder({ orderId, chargeId, code });
  if (!order) {
    req.log.warn({ orderId, chargeId, code }, 'Order not found (ignored)');
    return reply.send({ ok: true });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?').run(
    String(eventType),
    now,
    order.order_id,
  );

  // Fulfill only on configured "paid enough" events
  if (!env.fulfillOnEvents.includes(eventType)) return reply.send({ ok: true });

  if (order.fulfilled_at) {
    req.log.info({ orderId: order.order_id }, 'Already fulfilled (idempotent)');
    return reply.send({ ok: true });
  }

  // SECURITY: Always use the order's user_id and sku from the database,
  // NEVER trust metadata from the webhook payload.
  const effectiveSku = order.sku;
  const effectiveUser = order.user_id;

  const item = SKU_CATALOG[effectiveSku];
  if (!item) {
    req.log.error({ effectiveSku }, 'Unknown SKU in fulfillment');
    return reply.send({ ok: true });
  }

  // Fulfill and mark fulfilled atomically (SQLite transaction)
  const tx = db.transaction(() => {
    const wallet = grantForSku(db, effectiveUser, effectiveSku, item, {
      order_id: order.order_id,
      coinbase_charge_id: order.coinbase_charge_id,
      event_type: eventType,
    });
    db.prepare('UPDATE orders SET fulfilled_at = ?, updated_at = ? WHERE order_id = ?').run(
      now,
      now,
      order.order_id,
    );
    return wallet;
  });

  const wallet = tx();
  req.log.info({ orderId: order.order_id, userId: effectiveUser, wallet }, 'Fulfilled order');
  return reply.send({ ok: true });
});

try {
  await app.listen({ port: env.webhookPort, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
