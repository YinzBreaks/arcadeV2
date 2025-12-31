export async function createCharge({ apiKey, payload }) {
  const res = await fetch('https://api.commerce.coinbase.com/charges', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CC-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const message = json?.error?.message || json?.message || `Coinbase error (${res.status})`;
    const err = new Error(message);
    err.details = json?.error || json;
    err.status = res.status;
    throw err;
  }

  return json;
}
