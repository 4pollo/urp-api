import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CheckPermissionDto {
  @ApiProperty({ example: 'users:create', description: '待检查的权限标识' })
  @IsString()
  permission: string;
}
