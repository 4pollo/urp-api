import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccessGuard } from '../auth/access.guard';
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
});
