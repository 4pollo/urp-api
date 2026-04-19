import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsController } from './permissions.controller';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_ROLES_KEY,
} from '../auth/access.decorator';
import { PERMISSION_KEYS } from '../auth/permission-keys';
import { PermissionsService } from './permissions.service';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let permissionsService: { findAll: jest.Mock };

  beforeEach(async () => {
    permissionsService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: PermissionsService,
          useValue: permissionsService,
        },
      ],
    }).compile();

    controller = module.get<PermissionsController>(PermissionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards list query params including search and group', async () => {
    permissionsService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    await controller.findAll({
      page: 1,
      limit: 20,
      group: 'user',
      search: 'write',
    });

    expect(permissionsService.findAll).toHaveBeenCalledWith(1, 20, 'user', 'write');
  });

  it('uses permission metadata for permission read endpoints', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PermissionsController.prototype.findAll)).toEqual([PERMISSION_KEYS.permission.read]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PermissionsController.prototype.findOne)).toEqual([PERMISSION_KEYS.permission.read]);
  });

  it('keeps permission definition mutation as SuperAdmin-only', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, PermissionsController.prototype.create)).toEqual(['SuperAdmin']);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, PermissionsController.prototype.update)).toEqual(['SuperAdmin']);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, PermissionsController.prototype.remove)).toEqual(['SuperAdmin']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PermissionsController.prototype.create)).toBeUndefined();
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PermissionsController.prototype.update)).toBeUndefined();
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PermissionsController.prototype.remove)).toBeUndefined();
  });
});
