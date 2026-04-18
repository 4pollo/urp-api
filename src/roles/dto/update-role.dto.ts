import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Editor', description: '角色名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '内容编辑角色', description: '角色描述' })
  @IsOptional()
  @IsString()
  description?: string;
}
