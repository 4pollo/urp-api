import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AccessGuard } from '../src/auth/access.guard';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { RolesController } from '../src/roles/roles.controller';
import { RolesService } from '../src/roles/roles.service';
import { PermissionsController } from '../src/permissions/permissions.controller';
import { PermissionsService } from '../src/permissions/permissions.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { UserStatus } from '../src/users/entities/user-status.enum';

describe('Application e2e', () => {
  let app: INestApplication;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
    changePassword: jest.Mock;
    getMe: jest.Mock;
  };
  let usersService: {
    create: jest.Mock;
    findAll: jest.Mock;
  };
  let rolesService: {
    findAll: jest.Mock;
  };
  let permissionsService: {
    findAll: jest.Mock;
    checkPermission: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(async ({ email }: { email: string }) => {
        if (email === 'duplicate@example.com') {
          throw new ConflictException('Email already exists');
        }
        return {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: { id: 1, email, status: UserStatus.ACTIVE },
        };
      }),
      login: jest.fn(async ({ email }: { email: string }) => {
        if (email === 'frozen@example.com') {
          throw new UnauthorizedException('User account is frozen');
        }
        return {
          accessToken: email === 'admin@example.com' ? 'admin-token' : 'user-token',
          refreshToken: 'refresh-token',
          user: {
            id: email === 'admin@example.com' ? 2 : 1,
            email,
            status: UserStatus.ACTIVE,
          },
        };
      }),
      refreshToken: jest.fn(),
      logout: jest.fn(async (userId: number) => ({
        message: `logged out ${userId}`,
      })),
      changePassword: jest.fn(),
      getMe: jest.fn(async (userId: number) => ({
        id: userId,
        email: userId === 2 ? 'admin@example.com' : 'user@example.com',
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
        roles:
          userId === 2
            ? [{ id: 1, name: 'SuperAdmin' }]
            : [{ id: 2, name: 'Guest' }],
      })),
    };

    usersService = {
      create: jest.fn(async ({ email }: { email: string }) => ({
        id: 3,
        email,
        status: UserStatus.ACTIVE,
      })),
      findAll: jest.fn(async (page = 1, limit = 10, status?: UserStatus, roleId?: number) => ({
        items: [],
        total: 0,
        page,
        limit,
        status,
        roleId,
      })),
    };

    rolesService = {
      findAll: jest.fn(async (page = 1, limit = 10) => ({
        items: [{ id: 1, name: 'SuperAdmin', permissionCount: 1 }],
        total: 1,
        page,
        limit,
      })),
    };

    permissionsService = {
      findAll: jest.fn(async (page = 1, limit = 10, group?: string) => ({
        items: [],
        total: 0,
        page,
        limit,
        group,
      })),
      checkPermission: jest.fn(async () => ({ allowed: true })),
    };

    const fakeJwtGuard = {
      canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<{
          headers: { authorization?: string };
          user?: { userId: number };
        }>();
        const authHeader = request.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
          throw new UnauthorizedException('Unauthorized');
        }

        const token = authHeader.slice(7);

        if (token === 'admin-token') {
          request.user = { userId: 2 };
          return true;
        }

        if (token === 'user-token') {
          request.user = { userId: 1 };
          return true;
        }

        throw new UnauthorizedException('Unauthorized');
      },
    };

    const fakeAccessGuard = {
      canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<{ user?: { userId: number } }>();

        if (request.user?.userId === 2) {
          return true;
        }

        throw new ForbiddenException('Insufficient role');
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        RolesController,
        PermissionsController,
      ],
      providers: [
        Reflector,
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: RolesService, useValue: rolesService },
        { provide: PermissionsService, useValue: permissionsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeJwtGuard)
      .overrideGuard(AccessGuard)
      .useValue(fakeAccessGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('registers successfully with the standard success envelope', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          message: 'success',
          data: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: {
              id: 1,
              email: 'new@example.com',
              status: UserStatus.ACTIVE,
            },
          },
        });
      });
  });

  it('returns a conflict envelope for duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'duplicate@example.com', password: 'password123' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe(4002);
        expect(body.message).toBe('Email already exists');
        expect(body.data).toBeNull();
      });
  });

  it('rejects frozen users on login', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'frozen@example.com', password: 'password123' })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe(4001);
        expect(body.message).toBe('User account is frozen');
      });
  });

  it('rejects protected requests without a token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe(4001);
        expect(body.message).toBe('Unauthorized');
      });
  });

  it('returns the current user for authenticated requests', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer user-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.code).toBe(0);
        expect(body.data.email).toBe('user@example.com');
      });
  });

  it('rejects logout without a token', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe(4001);
        expect(body.message).toBe('Unauthorized');
      });
  });

  it('logs out the current user', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer user-token')
      .expect(201)
      .expect(({ body }) => {
        expect(body.code).toBe(0);
        expect(body.data).toEqual({ message: 'logged out 1' });
      });

    expect(authService.logout).toHaveBeenCalledWith(1);
  });

  it('blocks non-SuperAdmin users from admin-only endpoints', async () => {
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', 'Bearer user-token')
      .send({ email: 'created@example.com', password: 'password123' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe(4006);
        expect(body.message).toBe('Insufficient role');
      });
  });

  it('allows SuperAdmin users to access admin-only endpoints', async () => {
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ email: 'created@example.com', password: 'password123' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.code).toBe(0);
        expect(body.data).toEqual({
          id: 3,
          email: 'created@example.com',
          status: UserStatus.ACTIVE,
        });
      });
  });

  it('applies default users query dto values', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(usersService.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined);
  });

  it('rejects users limit greater than 50', async () => {
    await request(app.getHttpServer())
      .get('/api/users?limit=51')
      .set('Authorization', 'Bearer admin-token')
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(4003);
      });
  });

  it('rejects invalid users status query', async () => {
    await request(app.getHttpServer())
      .get('/api/users?status=disabled')
      .set('Authorization', 'Bearer admin-token')
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(4003);
      });
  });

  it('passes validated roles query dto values', async () => {
    await request(app.getHttpServer())
      .get('/api/roles?page=2&limit=20')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(rolesService.findAll).toHaveBeenCalledWith(2, 20);
  });

  it('rejects roles query parameters above max limit', async () => {
    await request(app.getHttpServer())
      .get('/api/roles?limit=99')
      .set('Authorization', 'Bearer admin-token')
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(4003);
      });
  });

  it('passes validated permissions query dto values', async () => {
    await request(app.getHttpServer())
      .get('/api/permissions?page=3&limit=5&group=user')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(permissionsService.findAll).toHaveBeenCalledWith(3, 5, 'user');
  });

  it('rejects unknown permissions query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/permissions?unknown=value')
      .set('Authorization', 'Bearer admin-token')
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe(4003);
      });
  });
});
