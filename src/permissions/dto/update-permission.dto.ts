import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional({ example: 'users:create', description: '权限标识' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({ example: 'users', description: '权限分组' })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional({ example: '允许创建用户', description: '权限描述' })
  @IsOptional()
  @IsString()
  description?: string;
}
