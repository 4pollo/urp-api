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
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { QueryPermissionsDto } from './dto/query-permissions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessGuard } from '../auth/access.guard';
import { RequireRoles } from '../auth/access.decorator';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get('permissions')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async findAll(@Query() query: QueryPermissionsDto) {
    return this.permissionsService.findAll(
      query.page,
      query.limit,
      query.group,
    );
  }

  @Get('permissions/me')
  async getUserPermissions(@Request() req: { user: { userId: number } }) {
    return this.permissionsService.getUserPermissions(req.user.userId);
  }

  @Get('permissions/:id')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.findOne(id);
  }

  @Post('permissions')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Put('permissions/:id')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete('permissions/:id')
  @UseGuards(AccessGuard)
  @RequireRoles('SuperAdmin')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.remove(id);
  }

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
