import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({
    description: '要分配给用户的角色 ID 列表',
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsInt({ each: true })
  roleIds: number[];
}
