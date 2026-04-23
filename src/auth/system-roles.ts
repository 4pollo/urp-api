export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  GUEST: 'Guest',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const SYSTEM_ROLE_NAMES: readonly string[] = [
  SYSTEM_ROLES.SUPER_ADMIN,
  SYSTEM_ROLES.GUEST,
];

export function isSystemRole(name: string): boolean {
  return SYSTEM_ROLE_NAMES.includes(name);
}
