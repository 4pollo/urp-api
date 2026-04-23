import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  IsArray,
  IsInt,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: '用户邮箱' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'password123',
    description: '用户密码，6-72 位',
    minLength: 6,
    maxLength: 72,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({
    description: '角色 ID 列表',
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  roleIds?: number[];
}
