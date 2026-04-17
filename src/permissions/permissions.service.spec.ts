import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { Permission } from './entities/permission.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let permissionRepo: {
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let userRoleRepo: { find: jest.Mock };

  beforeEach(async () => {
    permissionRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    userRoleRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(Permission), useValue: permissionRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(RolePermission), useValue: {} },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('returns paginated permissions in findAll', async () => {
    permissionRepo.findAndCount.mockResolvedValue([
      [{ id: 1, key: 'user:write', group: 'user', description: 'write user' }],
      18,
    ]);

    await expect(service.findAll(2, 10, 'user')).resolves.toEqual({
      items: [
        { id: 1, key: 'user:write', group: 'user', description: 'write user' },
      ],
      total: 18,
      page: 2,
      limit: 10,
    });

    expect(permissionRepo.findAndCount).toHaveBeenCalledWith({
      where: { group: 'user' },
      skip: 10,
      take: 10,
      order: {
        group: 'ASC',
        key: 'ASC',
      },
    });
  });

  it('rejects duplicate permission keys on create', async () => {
    permissionRepo.findOne.mockResolvedValue({ id: 1, key: 'user:read' });

    await expect(
      service.create({ key: 'user:read', group: 'user', description: 'dup' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('protects system permissions from update', async () => {
    permissionRepo.findOne.mockResolvedValue({ id: 1, key: 'user:read' });

    await expect(
      service.update(1, { description: 'changed' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('protects system permissions from delete', async () => {
    permissionRepo.findOne.mockResolvedValue({ id: 1, key: 'system:manage' });

    await expect(service.remove(1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('filters permissions by group in paginated findAll', async () => {
    permissionRepo.findAndCount.mockResolvedValue([
      [{ id: 1, key: 'user:write', group: 'user' }],
      1,
    ]);

    await service.findAll(1, 10, 'user');

    expect(permissionRepo.findAndCount).toHaveBeenCalledWith({
      where: { group: 'user' },
      skip: 0,
      take: 10,
      order: {
        group: 'ASC',
        key: 'ASC',
      },
    });
  });

  it('returns allowed when the user has the permission through any role', async () => {
    userRoleRepo.find.mockResolvedValue([
      {
        role: {
          permissions: [
            { permission: { key: 'user:read' } },
            { permission: { key: 'user:write' } },
          ],
        },
      },
      {
        role: {
          permissions: [{ permission: { key: 'user:write' } }],
        },
      },
    ]);

    await expect(service.checkPermission(1, 'user:write')).resolves.toEqual({
      allowed: true,
    });
  });

  it('aggregates unique roles and permissions for a user', async () => {
    userRoleRepo.find.mockResolvedValue([
      {
        role: {
          name: 'Editor',
          permissions: [
            { permission: { key: 'user:read' } },
            { permission: { key: 'user:write' } },
          ],
        },
      },
      {
        role: {
          name: 'Editor',
          permissions: [{ permission: { key: 'user:write' } }],
        },
      },
      {
        role: {
          name: 'Auditor',
          permissions: [{ permission: { key: 'user:read' } }],
        },
      },
    ]);

    await expect(service.getUserPermissions(1)).resolves.toEqual({
      permissions: ['user:read', 'user:write'],
      roles: ['Editor', 'Auditor'],
    });
  });
});
