import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private rolePermissionRepo: Repository<RolePermission>,
  ) {}

  async findAll(page: number = 1, limit: number = 10, group?: string) {
    const skip = (page - 1) * limit;
    const where = group ? { group } : {};

    const [permissions, total] = await this.permissionRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: {
        group: 'ASC',
        key: 'ASC',
      },
    });

    return {
      items: permissions,
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const permission = await this.permissionRepo.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async create(createPermissionDto: CreatePermissionDto) {
    const { key, group, description } = createPermissionDto;

    const existingPermission = await this.permissionRepo.findOne({
      where: { key },
    });

    if (existingPermission) {
      throw new ConflictException('Permission key already exists');
    }

    const permission = this.permissionRepo.create({
      key,
      group,
      description,
    });
    await this.permissionRepo.save(permission);

    return permission;
  }

  async update(id: number, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.permissionRepo.findOne({ where: { id } });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    if (this.isSystemPermission(permission.key)) {
      throw new BadRequestException('System permissions cannot be modified');
    }

    if (updatePermissionDto.key && updatePermissionDto.key !== permission.key) {
      const existingPermission = await this.permissionRepo.findOne({
        where: { key: updatePermissionDto.key },
      });
      if (existingPermission) {
        throw new ConflictException('Permission key already exists');
      }
    }

    await this.permissionRepo.update(id, updatePermissionDto);

    return {
      ...permission,
      ...updatePermissionDto,
    };
  }

  async remove(id: number) {
    const permission = await this.permissionRepo.findOne({ where: { id } });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    if (this.isSystemPermission(permission.key)) {
      throw new BadRequestException('System permissions cannot be deleted');
    }

    await this.permissionRepo.delete(id);

    return { message: 'Permission deleted successfully' };
  }

  async checkPermission(userId: number, permissionKey: string) {
    const userRoles = await this.userRoleRepo.find({
      where: { userId },
      relations: {
        role: {
          permissions: {
            permission: true,
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return {
      allowed: permissions.has(permissionKey),
    };
  }

  async getUserPermissions(userId: number) {
    const userRoles = await this.userRoleRepo.find({
      where: { userId },
      relations: {
        role: {
          permissions: {
            permission: true,
          },
        },
      },
    });

    const permissions = new Set<string>();
    const roles = new Set<string>();

    for (const userRole of userRoles) {
      roles.add(userRole.role.name);
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return {
      permissions: Array.from(permissions),
      roles: Array.from(roles),
    };
  }

  private isSystemPermission(permissionKey: string) {
    return [
      'user:read',
      'user:write',
      'user:delete',
      'role:read',
      'role:write',
      'role:delete',
      'permission:read',
      'permission:write',
      'permission:delete',
      'system:manage',
    ].includes(permissionKey);
  }
}
