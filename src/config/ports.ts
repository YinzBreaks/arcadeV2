export const PORTS = Object.freeze({
  DEV: Number(import.meta.env.VITE_DEV_PORT) || 5173,
  PREVIEW: Number(import.meta.env.VITE_PREVIEW_PORT) || 4173,
  API: Number(import.meta.env.VITE_API_PORT) || 8787,
  COINBASE_WEBHOOK: Number(import.meta.env.VITE_COINBASE_WEBHOOK_PORT) || 8788,
});
