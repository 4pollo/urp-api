import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', description: '用户邮箱' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'password123', description: '用户密码' })
  @IsString()
  @MaxLength(72)
  password: string;
}
