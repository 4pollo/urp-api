import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Permission } from '../permissions/entities/permission.entity';

describe('RolesService', () => {
  let service: RolesService;
  let roleRepo: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let permissionRepo: { find: jest.Mock };
  let transactionManager: {
    delete: jest.Mock;
    save: jest.Mock;
  };
  let rolePermissionRepo: {
    manager: { transaction: jest.Mock };
  };

  beforeEach(async () => {
    roleRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    permissionRepo = {
      find: jest.fn(),
    };
    transactionManager = {
      delete: jest.fn(),
      save: jest.fn(),
    };
    rolePermissionRepo = {
      manager: {
        transaction: jest.fn(async (callback: (manager: typeof transactionManager) => Promise<void>) => callback(transactionManager)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(RolePermission), useValue: rolePermissionRepo },
        { provide: getRepositoryToken(Permission), useValue: permissionRepo },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('returns paginated roles in findAll', async () => {
    roleRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 1,
          name: 'Editor',
          description: 'editor role',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          permissions: [{ permission: { id: 1 } }, { permission: { id: 2 } }],
        },
      ],
      12,
    ]);

    await expect(service.findAll(2, 5)).resolves.toEqual({
      items: [
        {
          id: 1,
          name: 'Editor',
          description: 'editor role',
          permissionCount: 2,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
      total: 12,
      page: 2,
      limit: 5,
    });

    expect(roleRepo.findAndCount).toHaveBeenCalledWith({
      skip: 5,
      take: 5,
      relations: {
        permissions: {
          permission: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  });

  it('rejects duplicate role names on create', async () => {
    roleRepo.findOne.mockResolvedValue({ id: 1, name: 'Admin' });

    await expect(
      service.create({ name: 'Admin', description: 'duplicate' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('protects system roles from update', async () => {
    roleRepo.findOne.mockResolvedValue({ id: 1, name: 'SuperAdmin' });

    await expect(
      service.update(1, { name: 'NewName' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate role names on update', async () => {
    roleRepo.findOne
      .mockResolvedValueOnce({ id: 1, name: 'Editor', description: 'old' })
      .mockResolvedValueOnce({ id: 2, name: 'Admin' });

    await expect(
      service.update(1, { name: 'Admin' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('protects system roles from delete', async () => {
    roleRepo.findOne.mockResolvedValue({ id: 1, name: 'Guest' });

    await expect(service.remove(1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects assigning missing permissions', async () => {
    roleRepo.findOne.mockResolvedValue({ id: 1, name: 'Editor' });
    permissionRepo.find.mockResolvedValue([{ id: 1 }]);

    await expect(
      service.assignPermissions(1, { permissionIds: [1, 2] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces role permissions in a transaction', async () => {
    roleRepo.findOne.mockResolvedValue({ id: 1, name: 'Editor' });
    permissionRepo.find.mockResolvedValue([{ id: 3 }, { id: 4 }]);

    const result = await service.assignPermissions(1, {
      permissionIds: [3, 4],
    });

    expect(transactionManager.delete).toHaveBeenCalledWith(RolePermission, {
      roleId: 1,
    });
    expect(transactionManager.save).toHaveBeenNthCalledWith(1, RolePermission, {
      roleId: 1,
      permissionId: 3,
    });
    expect(transactionManager.save).toHaveBeenNthCalledWith(2, RolePermission, {
      roleId: 1,
      permissionId: 4,
    });
    expect(result).toEqual({ message: 'Permissions assigned successfully' });
  });

  it('throws when assigning permissions to a missing role', async () => {
    roleRepo.findOne.mockResolvedValue(null);

    await expect(
      service.assignPermissions(1, { permissionIds: [1] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
