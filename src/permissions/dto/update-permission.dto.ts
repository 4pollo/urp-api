import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Matches,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional({ example: 'user:read', description: '权限标识，格式 module:action' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/, {
    message: 'key must follow format like "module:action" (e.g., "user:read")',
  })
  key?: string;

  @ApiPropertyOptional({ example: 'user', description: '权限分组' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  group?: string;

  @ApiPropertyOptional({ example: '允许创建用户', description: '权限描述' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: true, description: '是否显示在菜单' })
  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;

  @ApiPropertyOptional({ example: '用户管理', description: '菜单显示文本' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  menuLabel?: string;

  @ApiPropertyOptional({ example: 'users', description: '菜单图标标识' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  menuIcon?: string;

  @ApiPropertyOptional({ example: '/admin/users', description: '菜单路由路径' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  menuPath?: string;

  @ApiPropertyOptional({ example: 1, description: '菜单排序' })
  @IsOptional()
  @IsInt()
  @Min(0)
  menuOrder?: number;
}
