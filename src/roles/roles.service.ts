import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { isSystemRole } from '../auth/system-roles';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;
    const queryBuilder = this.roleRepo
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('rolePermission.permission', 'permission')
      .orderBy('role.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .distinct(true);

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(role.name) LIKE :search OR LOWER(role.description) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [roles, total] = await queryBuilder.getManyAndCount();

    return {
      items: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissionCount: role.permissions.length,
        createdAt: role.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: {
        permissions: {
          permission: true,
        },
        users: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      userCount: role.users.length,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        group: rp.permission.group,
        description: rp.permission.description,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async create(createRoleDto: CreateRoleDto) {
    const { name, description } = createRoleDto;

    const existingRole = await this.roleRepo.findOne({
      where: { name },
    });

    if (existingRole) {
      throw new ConflictException('Role name already exists');
    }

    const role = this.roleRepo.create({
      name,
      description,
    });
    await this.roleRepo.save(role);

    return {
      id: role.id,
      name: role.name,
      description: role.description,
    };
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    const role = await this.roleRepo.findOne({ where: { id } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (isSystemRole(role.name)) {
      throw new BadRequestException('System roles cannot be modified');
    }

    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.roleRepo.findOne({
        where: { name: updateRoleDto.name },
      });
      if (existingRole) {
        throw new ConflictException('Role name already exists');
      }
    }

    await this.roleRepo.update(id, updateRoleDto);

    return {
      id,
      name: updateRoleDto.name || role.name,
      description: updateRoleDto.description ?? role.description,
    };
  }

  async remove(id: number) {
    const role = await this.roleRepo.findOne({ where: { id } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (isSystemRole(role.name)) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    await this.roleRepo.delete(id);

    return { message: 'Role deleted successfully' };
  }

  async assignPermissions(
    id: number,
    assignPermissionsDto: AssignPermissionsDto,
  ) {
    const role = await this.roleRepo.findOne({ where: { id } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (isSystemRole(role.name)) {
      throw new BadRequestException('System roles cannot be modified');
    }

    const permissions = await this.permissionRepo.find({
      where: { id: In(assignPermissionsDto.permissionIds) },
    });

    if (permissions.length !== assignPermissionsDto.permissionIds.length) {
      throw new BadRequestException('One or more permissions do not exist');
    }

    await this.rolePermissionRepo.manager.transaction(async (manager) => {
      await manager.delete(RolePermission, { roleId: id });

      for (const permissionId of assignPermissionsDto.permissionIds) {
        await manager.save(RolePermission, {
          roleId: id,
          permissionId,
        });
      }
    });

    return { message: 'Permissions assigned successfully' };
  }
}
