export const PERMISSION_KEYS = {
  user: {
    read: 'user:read',
    write: 'user:write',
    delete: 'user:delete',
    updateStatus: 'user:update-status',
  },
  role: {
    read: 'role:read',
    write: 'role:write',
    delete: 'role:delete',
  },
  permission: {
    read: 'permission:read',
    write: 'permission:write',
    delete: 'permission:delete',
  },
  system: {
    manage: 'system:manage',
  },
} as const;

export const SYSTEM_PERMISSION_KEYS = [
  PERMISSION_KEYS.user.read,
  PERMISSION_KEYS.user.write,
  PERMISSION_KEYS.user.delete,
  PERMISSION_KEYS.user.updateStatus,
  PERMISSION_KEYS.role.read,
  PERMISSION_KEYS.role.write,
  PERMISSION_KEYS.role.delete,
  PERMISSION_KEYS.permission.read,
  PERMISSION_KEYS.permission.write,
  PERMISSION_KEYS.permission.delete,
  PERMISSION_KEYS.system.manage,
] as const;
