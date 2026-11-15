/**
 * Back-office access from the API's `roles` list (every user_roles row):
 * 'admin' if present, else 'moderator' if present, else undefined.
 * Only drives which links the UI shows; the API re-checks on every call.
 */
export type StaffRole = 'admin' | 'moderator';

export function staffRoleOf(roles: unknown): StaffRole | undefined {
  if (!Array.isArray(roles)) return undefined;
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('moderator')) return 'moderator';
  return undefined;
}
