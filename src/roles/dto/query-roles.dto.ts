import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TrimmedString } from '../../common/dto/decorators';

export class QueryRolesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '按角色名称搜索，前后空白会被自动去除',
    example: 'admin',
  })
  @TrimmedString()
  search?: string;
}
