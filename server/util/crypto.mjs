import crypto from 'node:crypto';

export function timingSafeEqualHex(aHex, bHex) {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function hmacSha256Hex(secret, rawBodyBuffer) {
  return crypto.createHmac('sha256', secret).update(rawBodyBuffer).digest('hex');
}
