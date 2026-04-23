import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Editor', description: '角色名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '内容编辑角色', description: '角色描述' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
