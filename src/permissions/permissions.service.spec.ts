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
    createQueryBuilder: jest.Mock;
  };
  let permissionQueryBuilder: {
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    andWhere: jest.Mock;
    getManyAndCount: jest.Mock;
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
      createQueryBuilder: jest.fn(),
    };
    permissionQueryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    permissionRepo.createQueryBuilder.mockReturnValue(permissionQueryBuilder);
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

  it('returns paginated permissions in findAll with group and search', async () => {
    permissionQueryBuilder.getManyAndCount.mockResolvedValue([
      [{ id: 1, key: 'user:write', group: 'user', description: 'write user' }],
      18,
    ]);

    await expect(service.findAll(2, 10, 'user', 'Write')).resolves.toEqual({
      items: [
        { id: 1, key: 'user:write', group: 'user', description: 'write user' },
      ],
      total: 18,
      page: 2,
      limit: 10,
    });

    expect(permissionRepo.createQueryBuilder).toHaveBeenCalledWith('permission');
    expect(permissionQueryBuilder.skip).toHaveBeenCalledWith(10);
    expect(permissionQueryBuilder.take).toHaveBeenCalledWith(10);
    expect(permissionQueryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'permission.group = :group',
      { group: 'user' },
    );
    expect(permissionQueryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      '(LOWER(permission.key) LIKE :search OR LOWER(permission.description) LIKE :search)',
      { search: '%write%' },
    );
  });

  it('does not add permission search filter when search is empty', async () => {
    permissionQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll(1, 10, 'user');

    expect(permissionQueryBuilder.andWhere).toHaveBeenCalledTimes(1);
    expect(permissionQueryBuilder.andWhere).toHaveBeenCalledWith(
      'permission.group = :group',
      { group: 'user' },
    );
  });

  it('rejects duplicate permission keys on create', async () => {
    permissionRepo.findOne.mockResolvedValue({ id: 1, key: 'user:read' });

    await expect(
      service.create({ key: 'user:read', group: 'user', description: 'dup' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('persists menu fields when creating a permission', async () => {
    permissionRepo.findOne.mockResolvedValue(null);
    permissionRepo.create.mockImplementation((dto) => dto);
    permissionRepo.save.mockImplementation(async (entity) => ({
      id: 99,
      ...entity,
    }));

    const dto = {
      key: 'article:publish',
      group: 'article',
      description: '发布文章',
      showInMenu: true,
      menuLabel: '文章管理',
      menuIcon: 'file',
      menuPath: '/admin/articles',
      menuOrder: 5,
    };

    const result = await service.create(dto);

    expect(permissionRepo.create).toHaveBeenCalledWith(dto);
    expect(permissionRepo.save).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({
      key: 'article:publish',
      showInMenu: true,
      menuLabel: '文章管理',
      menuPath: '/admin/articles',
      menuOrder: 5,
    });
  });

  it('rejects update that would leave a permission with showInMenu but no menuPath', async () => {
    permissionRepo.findOne.mockResolvedValue({
      id: 10,
      key: 'article:publish',
      group: 'article',
      showInMenu: false,
      menuLabel: null,
      menuPath: null,
    });

    await expect(
      service.update(10, { showInMenu: true, menuLabel: '文章' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(permissionRepo.update).not.toHaveBeenCalled();
  });

  it('allows updating only showInMenu when existing menuLabel and menuPath are present', async () => {
    permissionRepo.findOne.mockResolvedValue({
      id: 10,
      key: 'article:publish',
      group: 'article',
      showInMenu: false,
      menuLabel: '文章管理',
      menuPath: '/admin/articles',
    });

    await expect(
      service.update(10, { showInMenu: true }),
    ).resolves.toMatchObject({ showInMenu: true });
    expect(permissionRepo.update).toHaveBeenCalledWith(10, { showInMenu: true });
  });

  it('allows updating menu fields on a system permission with valid config', async () => {
    permissionRepo.findOne.mockResolvedValue({
      id: 1,
      key: 'user:read',
      showInMenu: true,
      menuLabel: '用户管理',
      menuPath: '/admin/users',
    });

    await expect(
      service.update(1, { menuOrder: 9 }),
    ).resolves.toMatchObject({ menuOrder: 9 });
    expect(permissionRepo.update).toHaveBeenCalledWith(1, { menuOrder: 9 });
  });

  it('rejects system permission update that breaks menu config', async () => {
    permissionRepo.findOne.mockResolvedValue({
      id: 1,
      key: 'user:read',
      showInMenu: true,
      menuLabel: '用户管理',
      menuPath: '/admin/users',
    });

    await expect(
      service.update(1, { menuPath: 'no-leading-slash' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(permissionRepo.update).not.toHaveBeenCalled();
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
    permissionQueryBuilder.getManyAndCount.mockResolvedValue([
      [{ id: 1, key: 'user:write', group: 'user' }],
      1,
    ]);

    await service.findAll(1, 10, 'user');

    expect(permissionQueryBuilder.andWhere).toHaveBeenCalledWith(
      'permission.group = :group',
      { group: 'user' },
    );
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

  it('checkPermission reuses request-level cache and avoids extra db call', async () => {
    userRoleRepo.find.mockResolvedValue([
      {
        role: {
          name: 'Editor',
          permissions: [{ permission: { key: 'user:read' } }],
        },
      },
    ]);
    const request = {} as {
      __userPermissionsCache?: Map<number, { permissions: string[]; roles: string[] }>;
    };

    await service.getUserPermissions(1, request);
    await expect(
      service.checkPermission(1, 'user:read', request),
    ).resolves.toEqual({ allowed: true });
    await expect(
      service.checkPermission(1, 'user:write', request),
    ).resolves.toEqual({ allowed: false });

    expect(userRoleRepo.find).toHaveBeenCalledTimes(1);
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

  it('reuses user permissions from request cache when available', async () => {
    userRoleRepo.find.mockResolvedValue([
      {
        role: {
          name: 'Editor',
          permissions: [{ permission: { key: 'user:read' } }],
        },
      },
    ]);
    const request = {} as {
      __userPermissionsCache?: Map<number, { permissions: string[]; roles: string[] }>;
    };

    const first = await service.getUserPermissions(1, request);
    const second = await service.getUserPermissions(1, request);

    expect(first).toEqual({ permissions: ['user:read'], roles: ['Editor'] });
    expect(second).toEqual(first);
    expect(userRoleRepo.find).toHaveBeenCalledTimes(1);
  });
});
