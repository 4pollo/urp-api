import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { UserStatus } from '../users/entities/user-status.enum';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SYSTEM_ROLES } from './system-roles';
import { LOGIN_ATTEMPT_STORE } from './login-attempt-store.token';
import type { LoginAttemptStore } from './login-attempt-store.interface';

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(LOGIN_ATTEMPT_STORE) private loginAttempts: LoginAttemptStore,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    const existingUser = await this.userRepo.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.userRepo.create({
      email,
      password: hashedPassword,
      status: UserStatus.ACTIVE,
    });
    await this.userRepo.save(user);

    const guestRole = await this.roleRepo.findOne({
      where: { name: SYSTEM_ROLES.GUEST },
    });

    if (guestRole) {
      await this.userRoleRepo.save({
        userId: user.id,
        roleId: guestRole.id,
      });
    }

    const tokens = this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(
      user.id,
      tokens.refreshToken,
      tokens.refreshTokenExpiresAt,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    };
  }

  async login(loginDto: LoginDto, clientIp?: string) {
    const { email, password } = loginDto;
    const emailKey = email.toLowerCase();

    // 账号锁定检查（先于密码校验，防止锁定期间持续触发 bcrypt 计算）
    const lockUntil = await this.loginAttempts.getLockUntil(emailKey);
    if (lockUntil) {
      this.logger.warn('Login blocked: account locked', {
        email: emailKey,
        ip: clientIp,
        lockUntil: new Date(lockUntil).toISOString(),
      });
      throw new UnauthorizedException(
        'Account temporarily locked due to too many failed attempts, please try again later',
      );
    }

    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      await this.recordFailedAttempt(emailKey, clientIp, 'user_not_found');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.FROZEN) {
      this.logger.warn('Login blocked: account frozen', {
        email: emailKey,
        userId: user.id,
        ip: clientIp,
      });
      throw new UnauthorizedException('User account is frozen');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(emailKey, clientIp, 'wrong_password');
      throw new UnauthorizedException('Invalid credentials');
    }

    // 登录成功：清空失败计数
    await this.loginAttempts.clear(emailKey);
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const tokens = this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(
      user.id,
      tokens.refreshToken,
      tokens.refreshTokenExpiresAt,
    );

    this.logger.log('Login success', {
      userId: user.id,
      email: emailKey,
      ip: clientIp,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    };
  }

  private async recordFailedAttempt(
    emailKey: string,
    clientIp: string | undefined,
    reason: 'user_not_found' | 'wrong_password',
  ): Promise<void> {
    const attempts = await this.loginAttempts.incrementFailed(emailKey);
    this.logger.warn('Login failed', {
      email: emailKey,
      ip: clientIp,
      reason,
      attempt: attempts,
    });

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const until = Date.now() + LOCK_DURATION_MS;
      await this.loginAttempts.lock(emailKey, until);
      this.logger.warn('Account locked due to repeated failures', {
        email: emailKey,
        ip: clientIp,
        attempts,
        lockUntil: new Date(until).toISOString(),
      });
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET');

      if (!jwtSecret) {
        throw new Error('JWT_SECRET is required');
      }

      const payload = this.jwtService.verify<{ sub: number }>(refreshToken, {
        secret: jwtSecret,
      });

      const user = await this.userRepo.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.status === UserStatus.FROZEN) {
        throw new UnauthorizedException('Invalid token');
      }

      if (!user.refreshTokenHash || !user.refreshTokenExpiresAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (user.refreshTokenExpiresAt.getTime() <= Date.now()) {
        await this.clearRefreshToken(user.id);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isRefreshTokenValid = await bcrypt.compare(
        refreshToken,
        user.refreshTokenHash,
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = this.generateTokens(user.id, user.email);
      await this.storeRefreshToken(
        user.id,
        tokens.refreshToken,
        tokens.refreshTokenExpiresAt,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: number) {
    await this.clearRefreshToken(userId);

    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.userRepo.update(userId, {
      password: hashedPassword,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });

    return { message: 'Password changed successfully' };
  }

  async getMe(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        roles: {
          role: true,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
    };
  }

  private generateTokens(userId: number, email: string) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required');
    }

    const payload = { sub: userId, email };
    const accessTokenExpiresIn =
      (this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m') as `${number}${
        | 's'
        | 'm'
        | 'h'
        | 'd'}`;
    const refreshTokenExpiresIn =
      (this.configService.get<string>('JWT_REFRESH_EXPIRES') || '7d') as `${number}${
        | 's'
        | 'm'
        | 'h'
        | 'd'}`;

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: refreshTokenExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: this.resolveExpiry(refreshTokenExpiresIn),
    };
  }

  private async storeRefreshToken(
    userId: number,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
  ) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await this.userRepo.update(userId, {
      refreshTokenHash,
      refreshTokenExpiresAt,
    });
  }

  private async clearRefreshToken(userId: number) {
    await this.userRepo.update(userId, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
  }

  private resolveExpiry(expiresIn: string): Date {
    const now = Date.now();
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multiplier =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 'h'
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;

    return new Date(now + value * multiplier);
  }
}
