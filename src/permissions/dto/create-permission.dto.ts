import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { IsValidMenuConfig } from './menu-config.validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'user:read', description: '权限标识，格式 module:action' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/, {
    message: 'key must follow format like "module:action" (e.g., "user:read")',
  })
  key: string;

  @ApiProperty({ example: 'user', description: '权限分组' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  group: string;

  @ApiPropertyOptional({ example: '允许创建用户', description: '权限描述' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: true, description: '是否显示在菜单。为 true 时 menuLabel 与 menuPath 必填' })
  @IsOptional()
  @IsBoolean()
  @IsValidMenuConfig()
  showInMenu?: boolean;

  @ApiPropertyOptional({ example: '用户管理', description: '菜单显示文本（showInMenu 为 true 时必填）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  menuLabel?: string;

  @ApiPropertyOptional({ example: 'users', description: '菜单图标标识' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  menuIcon?: string;

  @ApiPropertyOptional({ example: '/admin/users', description: '菜单路由路径，必须以 / 开头（showInMenu 为 true 时必填）' })
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
