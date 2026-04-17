import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { UserStatus } from './entities/user-status.enum';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let roleRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let transactionManager: {
    delete: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let userRoleRepo: {
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };

  beforeEach(async () => {
    transactionManager = {
      delete: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    roleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    userRoleRepo = {
      save: jest.fn(),
      manager: {
        transaction: jest.fn(async (callback: (manager: typeof transactionManager) => Promise<void>) => callback(transactionManager)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('creates a user with the Guest role when roleIds are omitted', async () => {
    const user = {
      id: 1,
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
    };

    userRepo.findOne.mockResolvedValueOnce(null);
    userRepo.create.mockReturnValue(user);
    userRepo.save.mockResolvedValue(user);
    roleRepo.findOne.mockResolvedValue({ id: 2, name: 'Guest' });
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const result = await service.create({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(userRepo.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    expect(userRoleRepo.save).toHaveBeenCalledWith({ userId: 1, roleId: 2 });
    expect(result).toEqual({
      id: 1,
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
    });
  });

  it('rejects duplicate email on create', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1, email: 'user@example.com' });

    await expect(
      service.create({ email: 'user@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns paginated users with status filter', async () => {
    userRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 1,
          email: 'user@example.com',
          status: UserStatus.ACTIVE,
          lastLoginAt: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          roles: [{ role: { id: 3, name: 'Editor' } }],
        },
      ],
      1,
    ]);

    const result = await service.findAll(2, 5, UserStatus.ACTIVE);

    expect(userRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: UserStatus.ACTIVE },
        skip: 5,
        take: 5,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.items[0]).toEqual({
      id: 1,
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      roles: [{ id: 3, name: 'Editor' }],
    });
  });

  it('uses the role query path when roleId is provided', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    userRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.findAll(1, 10, undefined, 9);

    expect(userRepo.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.where).toHaveBeenCalledWith('ur.roleId = :roleId', {
      roleId: 9,
    });
  });

  it('throws when finding a missing user', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate email on update', async () => {
    userRepo.findOne
      .mockResolvedValueOnce({ id: 1, email: 'old@example.com', status: UserStatus.ACTIVE })
      .mockResolvedValueOnce({ id: 2, email: 'new@example.com' });

    await expect(
      service.update(1, { email: 'new@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('clears refresh tokens when updating user status', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1 });

    const result = await service.updateStatus(1, { status: UserStatus.FROZEN });

    expect(userRepo.update).toHaveBeenCalledWith(1, {
      status: UserStatus.FROZEN,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
    expect(result).toEqual({ message: 'User status updated successfully' });
  });

  it('rejects assignRoles when any role id is missing', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1 });
    roleRepo.find.mockResolvedValue([{ id: 2 }]);

    await expect(
      service.assignRoles(1, { roleIds: [2, 3] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces user roles in a transaction and clears refresh tokens', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1 });
    roleRepo.find.mockResolvedValue([{ id: 2 }, { id: 3 }]);

    const result = await service.assignRoles(1, { roleIds: [2, 3] });

    expect(transactionManager.delete).toHaveBeenCalledWith(UserRole, { userId: 1 });
    expect(transactionManager.save).toHaveBeenNthCalledWith(1, UserRole, {
      userId: 1,
      roleId: 2,
    });
    expect(transactionManager.save).toHaveBeenNthCalledWith(2, UserRole, {
      userId: 1,
      roleId: 3,
    });
    expect(transactionManager.update).toHaveBeenCalledWith(User, 1, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
    expect(result).toEqual({ message: 'Roles assigned successfully' });
  });

  it('throws when removing a missing user', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
