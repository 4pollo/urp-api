import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessGuard } from '../auth/access.guard';
import {
  RequirePermissions,
  RequireRoles,
} from '../auth/access.decorator';
import {
  SUPER_ADMIN_ROLE,
  USER_PERMISSION_POLICIES,
} from '../auth/permission-policies';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';

@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: '未提供或提供了无效的 JWT。' })
@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: '分页查询用户列表' })
  @ApiBadRequestResponse({ description: '查询参数校验失败。' })
  @Get()
  @UseGuards(AccessGuard)
  @RequirePermissions(...USER_PERMISSION_POLICIES.read)
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(
      query.page,
      query.limit,
      query.status,
      query.roleId,
      query.search,
    );
  }

  @ApiOperation({ summary: '获取单个用户详情' })
  @ApiNotFoundResponse({ description: '用户不存在。' })
  @Get(':id')
  @UseGuards(AccessGuard)
  @RequirePermissions(...USER_PERMISSION_POLICIES.read)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: '创建用户' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @Post()
  @UseGuards(AccessGuard)
  @RequirePermissions(...USER_PERMISSION_POLICIES.create)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @ApiOperation({ summary: '更新用户信息' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiNotFoundResponse({ description: '用户不存在。' })
  @Put(':id')
  @UseGuards(AccessGuard)
  @RequirePermissions(...USER_PERMISSION_POLICIES.update)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @ApiOperation({ summary: '删除用户' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @ApiNotFoundResponse({ description: '用户不存在。' })
  @Delete(':id')
  @UseGuards(AccessGuard)
  @RequirePermissions(...USER_PERMISSION_POLICIES.delete)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.usersService.remove(id, req.user.userId);
  }

  @ApiOperation({ summary: '更新用户状态' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @ApiNotFoundResponse({ description: '用户不存在。' })
  @Patch(':id/status')
  @UseGuards(AccessGuard)
  @RequirePermissions(...USER_PERMISSION_POLICIES.updateStatus)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateStatus(id, updateUserStatusDto, req.user.userId);
  }

  @ApiOperation({ summary: '为用户分配角色' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @ApiNotFoundResponse({ description: '用户或角色不存在。' })
  @Put(':id/roles')
  @UseGuards(AccessGuard)
  @RequireRoles(...USER_PERMISSION_POLICIES.assignRoles)
  async assignRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignRolesDto: AssignRolesDto,
  ) {
    return this.usersService.assignRoles(id, assignRolesDto);
  }
}
