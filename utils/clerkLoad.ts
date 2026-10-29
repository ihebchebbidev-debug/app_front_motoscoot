/**
 * Decides when the Clerk sign-in runtime must be loaded. Kept separate and
 * pure so the rule is testable: load it only when it is actually needed.
 */
export function needsClerkNow(opts: { loginOpen: boolean; pathname: string; cookie: string }): boolean {
  if (opts.loginOpen) return true;
  if (opts.pathname === '/sso-callback' || opts.pathname.startsWith('/sso-callback/')) return true;
  // Clerk sets a readable `__client_uat` (or `__client_uat_<suffix>`) cookie;
  // a non-zero value means a Clerk session exists and must be bridged/signed out.
  return /(?:^|;\s*)__client_uat[^=]*=([1-9]\d*)/.test(opts.cookie || '');
}
