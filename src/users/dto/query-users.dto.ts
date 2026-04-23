import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { UserStatus } from '../entities/user-status.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TrimmedString } from '../../common/dto/decorators';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '按用户状态筛选',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: '按角色 ID 筛选',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId?: number;

  @ApiPropertyOptional({
    description: '按邮箱关键字搜索，前后空白会被自动去除',
    example: 'admin',
  })
  @TrimmedString()
  search?: string;
}
