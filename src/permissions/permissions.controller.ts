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
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { QueryPermissionsDto } from './dto/query-permissions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessGuard } from '../auth/access.guard';
import { RequireRoles } from '../auth/access.decorator';

@ApiTags('Permissions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: '未提供或提供了无效的 JWT。' })
@Controller('api')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @ApiOperation({ summary: '分页查询权限列表' })
  @ApiBadRequestResponse({ description: '查询参数校验失败。' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @Get('permissions')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async findAll(@Query() query: QueryPermissionsDto) {
    return this.permissionsService.findAll(
      query.page,
      query.limit,
      query.group,
      query.search,
    );
  }

  @ApiOperation({ summary: '获取当前用户权限列表' })
  @Get('permissions/me')
  async getUserPermissions(@Request() req: { user: { userId: number } }) {
    return this.permissionsService.getUserPermissions(req.user.userId);
  }

  @ApiOperation({ summary: '获取单个权限详情' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @ApiNotFoundResponse({ description: '权限不存在。' })
  @Get('permissions/:id')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.findOne(id);
  }

  @ApiOperation({ summary: '创建权限' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @Post('permissions')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @ApiOperation({ summary: '更新权限' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @ApiNotFoundResponse({ description: '权限不存在。' })
  @Put('permissions/:id')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @ApiOperation({ summary: '删除权限' })
  @ApiForbiddenResponse({ description: '需要 SuperAdmin 角色。' })
  @ApiNotFoundResponse({ description: '权限不存在。' })
  @Delete('permissions/:id')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.remove(id);
  }

  @ApiOperation({ summary: '检查当前用户是否拥有指定权限' })
  @ApiBadRequestResponse({ description: '请求参数校验失败。' })
  @Post('check')
  async checkPermission(
    @Request() req: { user: { userId: number } },
    @Body() checkPermissionDto: CheckPermissionDto,
  ) {
    return this.permissionsService.checkPermission(
      req.user.userId,
      checkPermissionDto.permission,
    );
  }
}
