import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'admin@example.com', description: '用户邮箱' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: '用户密码，至少 6 位',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
