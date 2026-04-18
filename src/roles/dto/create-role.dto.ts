import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Editor', description: '角色名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '内容编辑角色', description: '角色描述' })
  @IsOptional()
  @IsString()
  description?: string;
}
