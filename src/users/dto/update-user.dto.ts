import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'updated@example.com', description: '用户邮箱' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
