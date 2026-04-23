import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { UserStatus } from '../users/entities/user-status.enum';
import { LOGIN_ATTEMPT_STORE } from './login-attempt-store.token';
import type { LoginAttemptStore } from './login-attempt-store.interface';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let roleRepo: { findOne: jest.Mock };
  let userRoleRepo: { save: jest.Mock };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };
  let loginAttempts: jest.Mocked<LoginAttemptStore>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    roleRepo = {
      findOne: jest.fn(),
    };
    userRoleRepo = {
      save: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'secret';
        if (key === 'JWT_ACCESS_EXPIRES') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES') return '7d';
        return undefined;
      }),
    };
    loginAttempts = {
      getLockUntil: jest.fn().mockResolvedValue(null),
      incrementFailed: jest.fn().mockResolvedValue(1),
      lock: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: LOGIN_ATTEMPT_STORE, useValue: loginAttempts },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('registers a user, assigns Guest role, and stores refresh token', async () => {
    const user = {
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    };

    userRepo.findOne.mockResolvedValueOnce(null);
    userRepo.create.mockReturnValue(user);
    userRepo.save.mockResolvedValue(user);
    roleRepo.findOne.mockResolvedValue({ id: 2, name: 'Guest' });
    jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password').mockResolvedValueOnce('hashed-refresh');

    const result = await service.register({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(userRepo.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    expect(userRoleRepo.save).toHaveBeenCalledWith({ userId: 1, roleId: 2 });
    expect(userRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        refreshTokenHash: 'hashed-refresh',
        refreshTokenExpiresAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 1,
        email: 'user@example.com',
        status: UserStatus.ACTIVE,
      },
    });
  });

  it('rejects duplicate email on register', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1, email: 'user@example.com' });

    await expect(
      service.register({ email: 'user@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects login for frozen users', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.FROZEN,
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for invalid password', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'user@example.com', password: 'bad-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('records a failed attempt when password is wrong', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    loginAttempts.incrementFailed.mockResolvedValue(3);

    await expect(
      service.login({ email: 'User@Example.com', password: 'bad' }, '1.1.1.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(loginAttempts.incrementFailed).toHaveBeenCalledWith('user@example.com');
    expect(loginAttempts.lock).not.toHaveBeenCalled();
  });

  it('locks the account once failed attempts reach the threshold', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    loginAttempts.incrementFailed.mockResolvedValue(10);

    await expect(
      service.login({ email: 'user@example.com', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(loginAttempts.lock).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(Number),
    );
  });

  it('rejects login while account is locked, before checking password', async () => {
    loginAttempts.getLockUntil.mockResolvedValue(Date.now() + 60_000);

    await expect(
      service.login({ email: 'user@example.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(userRepo.findOne).not.toHaveBeenCalled();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('clears failed attempts after a successful login', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.sign
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');

    await service.login(
      { email: 'User@Example.com', password: 'good' },
      '1.1.1.1',
    );

    expect(loginAttempts.clear).toHaveBeenCalledWith('user@example.com');
  });

  it('also records a failed attempt when the user does not exist', async () => {
    userRepo.findOne.mockResolvedValue(null);
    loginAttempts.incrementFailed.mockResolvedValue(1);

    await expect(
      service.login({ email: 'ghost@example.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(loginAttempts.incrementFailed).toHaveBeenCalledWith('ghost@example.com');
  });

  it('rotates refresh token on successful login', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      status: UserStatus.ACTIVE,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');

    const result = await service.login({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(userRepo.update).toHaveBeenNthCalledWith(1, 1, {
      lastLoginAt: expect.any(Date),
    });
    expect(userRepo.update).toHaveBeenNthCalledWith(
      2,
      1,
      expect.objectContaining({
        refreshTokenHash: 'hashed-refresh',
        refreshTokenExpiresAt: expect.any(Date),
      }),
    );
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
  });

  it('rejects refresh when stored token state is missing', async () => {
    jwtService.verify.mockReturnValue({ sub: 1 });
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });

    await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('clears expired refresh token before rejecting it', async () => {
    jwtService.verify.mockReturnValue({ sub: 1 });
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
      refreshTokenHash: 'hashed-refresh',
      refreshTokenExpiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userRepo.update).toHaveBeenCalledWith(1, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
  });

  it('rejects refresh token hash mismatch', async () => {
    jwtService.verify.mockReturnValue({ sub: 1 });
    userRepo.findOne.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
      refreshTokenHash: 'hashed-refresh',
      refreshTokenExpiresAt: new Date(Date.now() + 1000),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('clears refresh tokens on logout', async () => {
    const result = await service.logout(1);

    expect(userRepo.update).toHaveBeenCalledWith(1, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
    expect(result).toEqual({ message: 'Logged out successfully' });
  });

  it('updates password and clears refresh tokens on changePassword', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      password: 'old-hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    const result = await service.changePassword(1, {
      oldPassword: 'old-password',
      newPassword: 'new-password',
    });

    expect(userRepo.update).toHaveBeenCalledWith(1, {
      password: 'new-hash',
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
    expect(result).toEqual({ message: 'Password changed successfully' });
  });

  it('rejects wrong old password on changePassword', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1, password: 'old-hash' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.changePassword(1, {
        oldPassword: 'bad-password',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

});
