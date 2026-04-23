import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 用于查询参数中的关键字字段：
 * - 自动 trim
 * - 空字符串视为 undefined（避免拼接出 LIKE '%%' 的全表扫描）
 * - 默认上限 100 字符，可按需调整
 */
export const TrimmedString = (max = 100) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() || undefined : value,
    ),
    IsString(),
    MaxLength(max),
  );
