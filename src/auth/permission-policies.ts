import { PERMISSION_KEYS } from './permission-keys';
import { SYSTEM_ROLES } from './system-roles';

export const SUPER_ADMIN_ROLE = SYSTEM_ROLES.SUPER_ADMIN;

export const USER_PERMISSION_POLICIES = {
  read: [PERMISSION_KEYS.user.read],
  create: [PERMISSION_KEYS.user.write],
  update: [PERMISSION_KEYS.user.write],
  updateStatus: [PERMISSION_KEYS.user.updateStatus],
  delete: [PERMISSION_KEYS.user.delete],
  assignRoles: [SUPER_ADMIN_ROLE],
} as const;

export const ROLE_PERMISSION_POLICIES = {
  read: [PERMISSION_KEYS.role.read],
  create: [PERMISSION_KEYS.role.write],
  update: [PERMISSION_KEYS.role.write],
  delete: [PERMISSION_KEYS.role.delete],
  assignPermissions: [SUPER_ADMIN_ROLE],
} as const;

export const PERMISSION_DEFINITION_POLICIES = {
  read: [PERMISSION_KEYS.permission.read],
  create: [SUPER_ADMIN_ROLE],
  update: [SUPER_ADMIN_ROLE],
  delete: [SUPER_ADMIN_ROLE],
} as const;
