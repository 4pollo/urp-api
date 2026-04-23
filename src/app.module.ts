import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';
import { UserRole } from './users/entities/user-role.entity';
import { Role } from './roles/entities/role.entity';
import { RolePermission } from './roles/entities/role-permission.entity';
import { Permission } from './permissions/entities/permission.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const username = configService.get<string>('DB_USERNAME');
        const password = configService.get<string>('DB_PASSWORD');
        const database = configService.get<string>('DB_DATABASE');
        const jwtSecret = configService.get<string>('JWT_SECRET');

        const missing: string[] = [];
        if (!username) missing.push('DB_USERNAME');
        if (!password) missing.push('DB_PASSWORD');
        if (!database) missing.push('DB_DATABASE');
        if (!jwtSecret) missing.push('JWT_SECRET');
        if (missing.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missing.join(', ')}. Please check your .env file.`,
          );
        }
        if (jwtSecret!.length < 16) {
          throw new Error('JWT_SECRET must be at least 16 characters long');
        }

        return {
          type: 'mysql',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 3306),
          username,
          password,
          database,
          entities: [User, UserRole, Role, RolePermission, Permission],
          synchronize: process.env.NODE_ENV !== 'production',
          // logging: process.env.NODE_ENV !== 'production',
          namingStrategy: new SnakeNamingStrategy(),
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
