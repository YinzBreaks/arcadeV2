# Resistance Arcade V2 - Real-Money Arcade PWA

A full-stack arcade application with Supabase authentication, Coinbase Commerce payments, and real-time credit management.

## Features
- Supabase Google SSO authentication
- Coinbase Commerce crypto payments
- SQLite ledger for orders/wallet/transactions
- Idempotent webhook fulfillment
- Server-authoritative play sessions
- Credit consumption and play passes
- Interactive arcade floor UX

## Setup
1. Copy `.env.example` → `.env`
2. Fill required environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key
   - `SUPABASE_URL` - Same as VITE_SUPABASE_URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (backend only)
   - `COINBASE_COMMERCE_API_KEY` - (Optional) For payments
   - `COINBASE_COMMERCE_WEBHOOK_SECRET` - (Optional) For webhook verification

3. Install dependencies:
```bash
npm install
```

## Run
```bash
npm run dev:all
```

This starts:
- **Frontend** (Vite): http://localhost:5173
- **API server**: http://localhost:8787
- **Webhook server**: http://localhost:8788

## Health Checks
- API: http://localhost:8787/health
- Webhook: http://localhost:8788/health

## Dev Auth Bypass (Local Development Only)

To skip Google SSO during local development, enable dev auth bypass in your `.env`:

```env
VITE_DEV_AUTH_BYPASS=1
DEV_AUTH_BYPASS=1
```

**When enabled:**
- Frontend skips Supabase auth guards
- Backend accepts `x-dev-user-id` header instead of JWT
- User operates as `dev_user` (or custom `DEV_USER_ID`)

**Security:**
- ✅ Only works when `NODE_ENV !== 'production'`
- ✅ Must be explicitly enabled with `=1`
- ✅ Defaults to disabled (`=0`) in `.env.example`
- ✅ Never ships to production

**To disable:** Set to `0` or remove from `.env`

## Service Worker (PWA)

This app does not currently register a service worker in development to avoid fetch interception issues.

**If you previously had a service worker installed:**
1. Open DevTools → Application → Service Workers
2. Click "Unregister" next to any registered workers
3. Application → Storage → Clear site data
4. Hard reload (Ctrl+Shift+R / Cmd+Shift+R)

## Database

SQLite database stored in `data/arcade.db` with tables:
- `orders` - Payment orders
- `wallets` - User credit balances
- `transactions` - Credit/debit ledger
- `play_sessions` - Active game sessions
