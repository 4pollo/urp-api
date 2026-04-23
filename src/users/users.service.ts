import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { UserStatus } from './entities/user-status.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { SYSTEM_ROLES } from '../auth/system-roles';

export interface UserListItem {
  id: number;
  email: string;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: Array<{
    id: number;
    name: string;
  }>;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: UserStatus,
    roleId?: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .distinct(true);

    if (status === UserStatus.ACTIVE || status === UserStatus.FROZEN) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('LOWER(user.email) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    if (roleId) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1
          FROM user_roles user_role_filter
          WHERE user_role_filter.userId = user.id
            AND user_role_filter.roleId = :roleId
        )`,
        { roleId },
      );
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map((user) => this.toUserListItem(user)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: {
        roles: {
          role: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
      })),
    };
  }

  async create(createUserDto: CreateUserDto) {
    const { email, password, roleIds } = createUserDto;

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

    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await this.userRoleRepo.save({
          userId: user.id,
          roleId,
        });
      }
    } else {
      const guestRole = await this.roleRepo.findOne({
        where: { name: SYSTEM_ROLES.GUEST },
      });
      if (guestRole) {
        await this.userRoleRepo.save({
          userId: user.id,
          roleId: guestRole.id,
        });
      }
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepo.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    await this.userRepo.update(id, updateUserDto);

    return {
      id,
      email: updateUserDto.email || user.email,
      status: user.status,
    };
  }

  async remove(id: number, currentUserId?: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: {
        roles: {
          role: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 防止 SuperAdmin 删除自己
    if (currentUserId && currentUserId === id) {
      const isSuperAdmin = user.roles.some(
        (userRole) => userRole.role.name === SYSTEM_ROLES.SUPER_ADMIN,
      );
      if (isSuperAdmin) {
        throw new BadRequestException('SuperAdmin cannot delete themselves');
      }
    }

    await this.userRepo.delete(id);

    return { message: 'User deleted successfully' };
  }

  async updateStatus(
    id: number,
    updateUserStatusDto: UpdateUserStatusDto,
    currentUserId?: number,
  ) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: {
        roles: {
          role: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 防止 SuperAdmin 冻结自己
    if (currentUserId && currentUserId === id) {
      const isSuperAdmin = user.roles.some(
        (userRole) => userRole.role.name === SYSTEM_ROLES.SUPER_ADMIN,
      );
      if (isSuperAdmin && updateUserStatusDto.status === UserStatus.FROZEN) {
        throw new BadRequestException('SuperAdmin cannot freeze themselves');
      }
    }

    await this.userRepo.update(id, {
      status: updateUserStatusDto.status,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });

    return { message: 'User status updated successfully' };
  }

  async assignRoles(id: number, assignRolesDto: AssignRolesDto) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: {
        roles: {
          role: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.roleRepo.find({
      where: { id: In(assignRolesDto.roleIds) },
    });

    if (roles.length !== assignRolesDto.roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }

    const hasSuperAdminRole = user.roles.some(
      (userRole) => userRole.role.name === SYSTEM_ROLES.SUPER_ADMIN,
    );
    const keepsSuperAdminRole = roles.some(
      (role) => role.name === SYSTEM_ROLES.SUPER_ADMIN,
    );

    if (hasSuperAdminRole && !keepsSuperAdminRole) {
      const superAdminRole = await this.roleRepo.findOne({
        where: { name: SYSTEM_ROLES.SUPER_ADMIN },
      });

      if (!superAdminRole) {
        throw new BadRequestException('SuperAdmin role does not exist');
      }

      const superAdminCount = await this.userRoleRepo.count({
        where: { roleId: superAdminRole.id },
      });

      if (superAdminCount === 1) {
        throw new BadRequestException(
          'The last SuperAdmin cannot be removed',
        );
      }
    }

    await this.userRoleRepo.manager.transaction(async (manager) => {
      await manager.delete(UserRole, { userId: id });

      for (const roleId of assignRolesDto.roleIds) {
        await manager.save(UserRole, {
          userId: id,
          roleId,
        });
      }

      await manager.update(User, id, {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      });
    });

    return { message: 'Roles assigned successfully' };
  }

  private toUserListItem(user: User): UserListItem {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map((userRole) => ({
        id: userRole.role.id,
        name: userRole.role.name,
      })),
    };
  }
}
