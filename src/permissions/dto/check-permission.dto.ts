import { IsString } from 'class-validator';

export class CheckPermissionDto {
  @IsString()
  permission: string;
}
