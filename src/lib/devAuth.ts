/**
 * Dev auth bypass helpers
 * SECURITY: Only active when VITE_DEV_AUTH_BYPASS=1 in .env
 */

const DEV_BYPASS_ENABLED = import.meta.env.VITE_DEV_AUTH_BYPASS === '1';
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID || 'dev_user';

/**
 * Check if dev auth bypass is enabled
 */
export function isDevAuthBypassEnabled(): boolean {
  return DEV_BYPASS_ENABLED;
}

/**
 * Get dev user ID for headers
 */
export function getDevUserId(): string {
  return DEV_USER_ID;
}

/**
 * Add auth headers to fetch options
 * - If dev bypass enabled: adds x-dev-user-id
 * - Otherwise: expects caller to add Authorization: Bearer token
 */
export function addAuthHeaders(headers: HeadersInit = {}, accessToken?: string): HeadersInit {
  const result = { ...headers } as Record<string, string>;

  if (DEV_BYPASS_ENABLED) {
    result['x-dev-user-id'] = DEV_USER_ID;
  } else if (accessToken) {
    result['Authorization'] = `Bearer ${accessToken}`;
  }

  return result;
}
