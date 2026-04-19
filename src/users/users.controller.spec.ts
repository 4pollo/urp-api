import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccessGuard } from '../auth/access.guard';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_ROLES_KEY,
} from '../auth/access.decorator';
import { PERMISSION_KEYS } from '../auth/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { findAll: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: PermissionsService,
          useValue: {},
        },
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        AccessGuard,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards list query params including search', async () => {
    usersService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    await controller.findAll({
      page: 1,
      limit: 20,
      status: undefined,
      roleId: 2,
      search: 'test',
    });

    expect(usersService.findAll).toHaveBeenCalledWith(1, 20, undefined, 2, 'test');
  });

  it('uses permission metadata for read and write endpoints', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UsersController.prototype.findAll)).toEqual([PERMISSION_KEYS.user.read]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UsersController.prototype.findOne)).toEqual([PERMISSION_KEYS.user.read]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UsersController.prototype.create)).toEqual([PERMISSION_KEYS.user.write]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UsersController.prototype.update)).toEqual([PERMISSION_KEYS.user.write]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UsersController.prototype.updateStatus)).toEqual([PERMISSION_KEYS.user.updateStatus]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UsersController.prototype.remove)).toEqual([PERMISSION_KEYS.user.delete]);
  });

  it('keeps user role assignment as SuperAdmin-only', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, UsersController.prototype.assignRoles)).toEqual(['SuperAdmin']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UsersController.prototype.assignRoles)).toBeUndefined();
  });
});
