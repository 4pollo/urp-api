import { IsArray, IsInt } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @IsInt({ each: true })
  roleIds: number[];
}
