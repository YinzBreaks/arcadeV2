# Resistance Arcade V2 - Coinbase Commerce Fulfillment (Dev Skeleton)

This build adds:
- Coinbase Commerce create-charge (server)
- Webhook signature verification (server)
- SQLite ledger for orders/wallet/transactions
- Idempotent fulfillment on webhook events

## Setup
1) Copy `.env.example` -> `.env`
2) Fill:
   - COINBASE_COMMERCE_API_KEY
   - COINBASE_COMMERCE_WEBHOOK_SECRET
3) Install:
```bash
npm install
```

## Run
```bash
npm run dev:all
```

## Health
- API: http://localhost:8787/health
- Webhook: http://localhost:8788/health

## Dev user
Until SSO is wired, the UI uses a dev header `x-dev-user-id: dev_user`.
This will be replaced by Supabase JWT later.
