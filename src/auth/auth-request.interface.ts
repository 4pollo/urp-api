import type { Request } from 'express';

export interface AuthPayload {
  userId: number;
  email: string;
}

export type UserPermissionsCache = Map<
  number,
  { permissions: string[]; roles: string[] }
>;

export interface AuthenticatedRequest extends Request {
  user: AuthPayload;
  __userPermissionsCache?: UserPermissionsCache;
}
