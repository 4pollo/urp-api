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
import { validateMenuConfig } from './dto/menu-config.validator';
import { SYSTEM_PERMISSION_KEYS } from '../auth/permission-keys';
import { SYSTEM_ROLES } from '../auth/system-roles';

type UserPermissionSnapshot = {
  permissions: string[];
  roles: string[];
};

type PermissionCacheRequest = {
  __userPermissionsCache?: Map<number, UserPermissionSnapshot>;
};

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

  async findAll(
    page: number = 1,
    limit: number = 10,
    group?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const queryBuilder = this.permissionRepo
      .createQueryBuilder('permission')
      .orderBy('permission.group', 'ASC')
      .addOrderBy('permission.key', 'ASC')
      .skip(skip)
      .take(limit);

    if (group) {
      queryBuilder.andWhere('permission.group = :group', { group });
    }

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(permission.key) LIKE :search OR LOWER(permission.description) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [permissions, total] = await queryBuilder.getManyAndCount();

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
    const existingPermission = await this.permissionRepo.findOne({
      where: { key: createPermissionDto.key },
    });

    if (existingPermission) {
      throw new ConflictException('Permission key already exists');
    }

    const permission = this.permissionRepo.create(createPermissionDto);
    await this.permissionRepo.save(permission);

    return permission;
  }

  async update(id: number, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.permissionRepo.findOne({ where: { id } });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // 系统权限只允许修改菜单配置，不允许修改核心字段
    if (this.isSystemPermission(permission.key)) {
      const { key, group, description, ...menuFields } = updatePermissionDto;

      // 如果尝试修改核心字段，拒绝
      if (key !== undefined || group !== undefined || description !== undefined) {
        throw new BadRequestException('System permissions core fields cannot be modified');
      }

      this.assertMenuConfigValid(permission, menuFields);

      // 只更新菜单配置字段
      await this.permissionRepo.update(id, menuFields);

      return {
        ...permission,
        ...menuFields,
      };
    }

    if (updatePermissionDto.key && updatePermissionDto.key !== permission.key) {
      const existingPermission = await this.permissionRepo.findOne({
        where: { key: updatePermissionDto.key },
      });
      if (existingPermission) {
        throw new ConflictException('Permission key already exists');
      }
    }

    this.assertMenuConfigValid(permission, updatePermissionDto);

    await this.permissionRepo.update(id, updatePermissionDto);

    return {
      ...permission,
      ...updatePermissionDto,
    };
  }

  private assertMenuConfigValid(
    current: Permission,
    patch: Partial<UpdatePermissionDto>,
  ) {
    const merged = {
      showInMenu: patch.showInMenu ?? current.showInMenu,
      menuLabel: patch.menuLabel ?? current.menuLabel,
      menuPath: patch.menuPath ?? current.menuPath,
    };
    const error = validateMenuConfig(merged);
    if (error) {
      throw new BadRequestException(error);
    }
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

  async getUserPermissions(userId: number, request?: PermissionCacheRequest) {
    const cached = request?.__userPermissionsCache?.get(userId);
    if (cached) {
      return cached;
    }

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

    const result = {
      permissions: Array.from(permissions),
      roles: Array.from(roles),
    };

    if (request) {
      if (!request.__userPermissionsCache) {
        request.__userPermissionsCache = new Map<number, UserPermissionSnapshot>();
      }
      request.__userPermissionsCache.set(userId, result);
    }

    return result;
  }

  async getMenuItems(userId: number) {
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

    const isSuperAdmin = userRoles.some((ur) => ur.role.name === SYSTEM_ROLES.SUPER_ADMIN);

    let menuPermissions: Permission[];

    if (isSuperAdmin) {
      // SuperAdmin sees all menu items
      menuPermissions = await this.permissionRepo.find({
        where: { showInMenu: true },
        order: { menuOrder: 'ASC', id: 'ASC' },
      });
    } else {
      // Regular users see only their permitted menu items
      const permissionIds = new Set<number>();
      for (const userRole of userRoles) {
        for (const rolePermission of userRole.role.permissions) {
          permissionIds.add(rolePermission.permission.id);
        }
      }

      if (permissionIds.size === 0) {
        return { items: [] };
      }

      menuPermissions = await this.permissionRepo.find({
        where: { showInMenu: true },
        order: { menuOrder: 'ASC', id: 'ASC' },
      });

      menuPermissions = menuPermissions.filter((p) => permissionIds.has(p.id));
    }

    return {
      items: menuPermissions.map((p) => ({
        id: p.id,
        key: p.key,
        menuLabel: p.menuLabel || p.description || p.key,
        menuIcon: p.menuIcon || 'circle',
        menuPath: p.menuPath || '/',
        menuOrder: p.menuOrder,
      })),
    };
  }

  private isSystemPermission(permissionKey: string) {
    return SYSTEM_PERMISSION_KEYS.includes(permissionKey as (typeof SYSTEM_PERMISSION_KEYS)[number]);
  }
}
