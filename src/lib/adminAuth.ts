/**
 * Admin authorization check.
 * Passphrase requirement has been removed so the admin dashboard
 * and admin API endpoints are accessible directly without credentials.
 */
export function isAdmin(_req?: Request): boolean {
  return true;
}

