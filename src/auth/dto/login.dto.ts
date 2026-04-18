import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', description: '用户邮箱' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', description: '用户密码' })
  @IsString()
  password: string;
}
