import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessGuard } from '../auth/access.guard';
import { RequireRoles } from '../auth/access.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: '未提供或提供了无效的 JWT。' })
@ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
@Controller('api/roles')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireRoles('SuperAdmin')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @ApiOperation({ summary: '分页查询角色列表' })
  @ApiBadRequestResponse({ description: '查询参数校验失败。' })
  @Get()
  async findAll(@Query() query: QueryRolesDto) {
    return this.rolesService.findAll(query.page, query.limit, query.search);
  }

  @ApiOperation({ summary: '获取单个角色详情' })
  @ApiNotFoundResponse({ description: '角色不存在。' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @ApiOperation({ summary: '创建角色' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @Post()
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @ApiOperation({ summary: '更新角色' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiNotFoundResponse({ description: '角色不存在。' })
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @ApiOperation({ summary: '删除角色' })
  @ApiNotFoundResponse({ description: '角色不存在。' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @ApiOperation({ summary: '为角色分配权限' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiNotFoundResponse({ description: '角色或权限不存在。' })
  @Put(':id/permissions')
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, assignPermissionsDto);
  }
}
