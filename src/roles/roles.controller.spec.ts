import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { AccessGuard } from '../auth/access.guard';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_ROLES_KEY,
} from '../auth/access.decorator';
import { PERMISSION_KEYS } from '../auth/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';

describe('RolesController', () => {
  let controller: RolesController;
  let rolesService: { findAll: jest.Mock };

  beforeEach(async () => {
    rolesService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: rolesService,
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

    controller = module.get<RolesController>(RolesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards list query params including search', async () => {
    rolesService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    await controller.findAll({
      page: 1,
      limit: 20,
      search: 'admin',
    });

    expect(rolesService.findAll).toHaveBeenCalledWith(1, 20, 'admin');
  });

  it('uses permission metadata for role CRUD endpoints', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, RolesController.prototype.findAll)).toEqual([PERMISSION_KEYS.role.read]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, RolesController.prototype.findOne)).toEqual([PERMISSION_KEYS.role.read]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, RolesController.prototype.create)).toEqual([PERMISSION_KEYS.role.write]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, RolesController.prototype.update)).toEqual([PERMISSION_KEYS.role.write]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, RolesController.prototype.remove)).toEqual([PERMISSION_KEYS.role.delete]);
  });

  it('keeps role permission assignment as SuperAdmin-only', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, RolesController.prototype.assignPermissions)).toEqual(['SuperAdmin']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, RolesController.prototype.assignPermissions)).toBeUndefined();
  });
});
