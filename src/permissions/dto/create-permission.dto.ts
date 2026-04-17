import { IsString, IsOptional } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  key: string;

  @IsString()
  group: string;

  @IsOptional()
  @IsString()
  description?: string;
}
