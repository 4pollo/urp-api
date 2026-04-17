import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { AccessGuard } from '../auth/access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission, UserRole, Role, RolePermission]),
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService, AccessGuard],
  exports: [PermissionsService, AccessGuard],
})
export class PermissionsModule {}
