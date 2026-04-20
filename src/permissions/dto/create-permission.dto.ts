import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'users:create', description: '权限标识' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'users', description: '权限分组' })
  @IsString()
  group: string;

  @ApiPropertyOptional({ example: '允许创建用户', description: '权限描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, description: '是否显示在菜单' })
  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;

  @ApiPropertyOptional({ example: '用户管理', description: '菜单显示文本' })
  @IsOptional()
  @IsString()
  menuLabel?: string;

  @ApiPropertyOptional({ example: 'users', description: '菜单图标标识' })
  @IsOptional()
  @IsString()
  menuIcon?: string;

  @ApiPropertyOptional({ example: '/admin/users', description: '菜单路由路径' })
  @IsOptional()
  @IsString()
  menuPath?: string;

  @ApiPropertyOptional({ example: 1, description: '菜单排序' })
  @IsOptional()
  @IsInt()
  menuOrder?: number;
}
