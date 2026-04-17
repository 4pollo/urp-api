import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { AccessGuard } from '../auth/access.guard';
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
});
