import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'admin@example.com', description: '用户邮箱' })
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
}
