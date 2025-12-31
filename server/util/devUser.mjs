export function getDevUserId(req) {
  const v = req.headers['x-dev-user-id'];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
