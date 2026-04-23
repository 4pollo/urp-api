import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { logout: jest.Mock };

  beforeEach(async () => {
    authService = {
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards current user id on logout', async () => {
    authService.logout.mockResolvedValue({ message: 'Logged out successfully' });

    await controller.logout({ user: { userId: 1, email: 'a@b.com' } } as never);

    expect(authService.logout).toHaveBeenCalledWith(1);
  });
});
