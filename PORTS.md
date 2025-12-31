# arcadeV2 Port Registry

Reserved ports for this project.

- 5173  Vite dev server (strict)
- 4173  Vite preview (strict)
- 8787  Local API (Fastify)
- 8788  Coinbase Commerce webhook receiver (Fastify)
- 4040  Tunnel admin UI (ngrok/cloudflared)
- 54321 Supabase local (if enabled)

Rules:
- strictPort must be enabled
- no auto-port hopping
