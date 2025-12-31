import { getEnv } from '../env.mjs';

/**
 * Verifies a Supabase JWT access token using the Supabase Admin API.
 * Returns the authenticated user's ID or null if invalid.
 *
 * @param {string} accessToken - The JWT access token from Authorization header
 * @returns {Promise<{ userId: string } | null>} - User info or null if invalid
 */
export async function verifySupabaseToken(accessToken) {
  const env = getEnv();

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.');
  }

  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.supabaseServiceRoleKey,
      },
    });

    if (!res.ok) {
      return null;
    }

    const user = await res.json();

    if (!user || !user.id) {
      return null;
    }

    return { userId: user.id };
  } catch {
    return null;
  }
}

/**
 * Extracts the Bearer token from the Authorization header.
 *
 * @param {import('fastify').FastifyRequest} req - Fastify request object
 * @returns {string | null} - The token or null if not present/invalid format
 */
export function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

  const token = parts[1];
  return token && token.length > 0 ? token : null;
}

/**
 * Authenticates a request using Supabase JWT.
 * In dev mode with DEV_AUTH_BYPASS=1, falls back to x-dev-user-id header.
 * Returns the user ID or sends a 401 response.
 *
 * @param {import('fastify').FastifyRequest} req - Fastify request object
 * @param {import('fastify').FastifyReply} reply - Fastify reply object
 * @returns {Promise<string | null>} - User ID or null (response already sent)
 */
export async function authenticateRequest(req, reply) {
  const env = getEnv();
  const token = extractBearerToken(req);

  // Try Supabase JWT first
  if (token) {
    const result = await verifySupabaseToken(token);
    if (result) {
      return result.userId;
    }
  }

  // Dev auth bypass fallback (NEVER in production)
  if (
    env.devAuthBypass &&
    process.env.NODE_ENV !== 'production'
  ) {
    const devUserId = req.headers['x-dev-user-id'];
    if (typeof devUserId === 'string' && devUserId.trim()) {
      req.log.warn({ devUserId }, 'DEV AUTH BYPASS ACTIVE - Using x-dev-user-id header');
      return devUserId.trim();
    }
    // Fallback to default dev user
    req.log.warn({ devUserId: env.devUserId }, 'DEV AUTH BYPASS ACTIVE - Using default DEV_USER_ID');
    return env.devUserId;
  }

  // No valid auth
  reply.code(401).send({ ok: false, error: 'Missing or invalid Authorization header.' });
  return null;
}
