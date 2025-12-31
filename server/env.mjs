export function getEnv() {
  const apiPort = Number(process.env.API_PORT || 8787);
  const webhookPort = Number(process.env.COINBASE_WEBHOOK_PORT || 8788);

  const fulfillOnEvents = String(process.env.COINBASE_FULFILL_ON_EVENTS || 'charge:confirmed')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    apiPort,
    webhookPort,
    appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
    coinbaseApiKey: process.env.COINBASE_COMMERCE_API_KEY || '',
    coinbaseWebhookSecret: process.env.COINBASE_COMMERCE_WEBHOOK_SECRET || '',
    fulfillOnEvents,
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}
