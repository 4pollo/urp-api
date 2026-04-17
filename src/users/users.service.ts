import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { UserStatus } from './entities/user-status.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

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
    status?: string,
    roleId?: number,
  ) {
    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<User> = {};

    if (status === UserStatus.ACTIVE || status === UserStatus.FROZEN) {
      where.status = status;
    }

    if (roleId) {
      const [items, total] = await this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.roles', 'ur')
        .leftJoinAndSelect('ur.role', 'role')
        .where('ur.roleId = :roleId', { roleId })
        .skip(skip)
        .take(limit)
        .orderBy('user.createdAt', 'DESC')
        .getManyAndCount();

      return {
        items: items.map((user) => this.toUserListItem(user)),
        total,
        page,
        limit,
      };
    }

    const [items, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take: limit,
      relations: {
        roles: {
          role: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

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
        where: { name: 'Guest' },
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

  async remove(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepo.delete(id);

    return { message: 'User deleted successfully' };
  }

  async updateStatus(id: number, updateUserStatusDto: UpdateUserStatusDto) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepo.update(id, {
      status: updateUserStatusDto.status,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });

    return { message: 'User status updated successfully' };
  }

  async assignRoles(id: number, assignRolesDto: AssignRolesDto) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.roleRepo.find({
      where: { id: In(assignRolesDto.roleIds) },
    });

    if (roles.length !== assignRolesDto.roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
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
