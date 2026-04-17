import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessGuard } from './access.guard';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_ROLES_KEY,
} from './access.decorator';

describe('AccessGuard', () => {
  let guard: AccessGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let permissionsService: { getUserPermissions: jest.Mock };

  const createContext = (user?: { userId: number }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === REQUIRED_ROLES_KEY) return [];
        if (key === REQUIRED_PERMISSIONS_KEY) return [];
        return undefined;
      }),
    };
    permissionsService = {
      getUserPermissions: jest.fn(),
    };
    guard = new AccessGuard(reflector as Reflector, permissionsService as never);
  });

  it('allows access when no role or permission metadata is present', async () => {
    await expect(guard.canActivate(createContext({ userId: 1 }))).resolves.toBe(
      true,
    );
    expect(permissionsService.getUserPermissions).not.toHaveBeenCalled();
  });

  it('rejects requests without an authenticated user', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRED_ROLES_KEY) return ['SuperAdmin'];
      return [];
    });

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows SuperAdmin users to bypass other checks', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRED_ROLES_KEY) return ['Editor'];
      if (key === REQUIRED_PERMISSIONS_KEY) return ['user:delete'];
      return [];
    });
    permissionsService.getUserPermissions.mockResolvedValue({
      roles: ['SuperAdmin'],
      permissions: [],
    });

    await expect(guard.canActivate(createContext({ userId: 1 }))).resolves.toBe(
      true,
    );
  });

  it('rejects users without the required role', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRED_ROLES_KEY) return ['SuperAdmin'];
      return [];
    });
    permissionsService.getUserPermissions.mockResolvedValue({
      roles: ['Guest'],
      permissions: ['user:read'],
    });

    await expect(guard.canActivate(createContext({ userId: 1 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects users without the required permission', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRED_PERMISSIONS_KEY) return ['user:delete'];
      return [];
    });
    permissionsService.getUserPermissions.mockResolvedValue({
      roles: ['Editor'],
      permissions: ['user:read'],
    });

    await expect(guard.canActivate(createContext({ userId: 1 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows users with a matching required permission', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRED_PERMISSIONS_KEY) return ['user:write'];
      return [];
    });
    permissionsService.getUserPermissions.mockResolvedValue({
      roles: ['Editor'],
      permissions: ['user:read', 'user:write'],
    });

    await expect(guard.canActivate(createContext({ userId: 1 }))).resolves.toBe(
      true,
    );
  });
});
