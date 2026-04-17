import { IsArray, IsInt } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @IsInt({ each: true })
  permissionIds: number[];
}
