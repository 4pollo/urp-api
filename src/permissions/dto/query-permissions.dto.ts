import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TrimmedString } from '../../common/dto/decorators';

export class QueryPermissionsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '按权限分组筛选',
    example: 'user',
  })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional({
    description: '按权限关键字搜索，前后空白会被自动去除',
    example: 'create',
  })
  @TrimmedString()
  search?: string;
}
