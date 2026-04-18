import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

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
}
