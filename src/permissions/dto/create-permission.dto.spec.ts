import { validate } from 'class-validator';
import { CreatePermissionDto } from './create-permission.dto';

function makeDto(overrides: Partial<CreatePermissionDto> = {}): CreatePermissionDto {
  const dto = new CreatePermissionDto();
  dto.key = 'article:publish';
  dto.group = 'article';
  Object.assign(dto, overrides);
  return dto;
}

describe('CreatePermissionDto menu config validation', () => {
  it('accepts when showInMenu is omitted', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('accepts when showInMenu is false', async () => {
    const errors = await validate(makeDto({ showInMenu: false }));
    expect(errors).toHaveLength(0);
  });

  it('accepts a complete menu config', async () => {
    const errors = await validate(
      makeDto({
        showInMenu: true,
        menuLabel: '文章管理',
        menuPath: '/admin/articles',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects when showInMenu is true but menuLabel is missing', async () => {
    const errors = await validate(
      makeDto({ showInMenu: true, menuPath: '/admin/articles' }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('showInMenu');
    expect(errors[0].constraints?.menuConfigValid).toBe(
      'menuLabel is required when showInMenu is true',
    );
  });

  it('rejects when showInMenu is true but menuPath is missing', async () => {
    const errors = await validate(
      makeDto({ showInMenu: true, menuLabel: '文章管理' }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.menuConfigValid).toBe(
      'menuPath is required when showInMenu is true',
    );
  });

  it('rejects when menuPath does not start with /', async () => {
    const errors = await validate(
      makeDto({
        showInMenu: true,
        menuLabel: '文章管理',
        menuPath: 'admin/articles',
      }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.menuConfigValid).toBe(
      'menuPath must start with "/"',
    );
  });

  it('rejects when menuLabel is whitespace-only', async () => {
    const errors = await validate(
      makeDto({
        showInMenu: true,
        menuLabel: '   ',
        menuPath: '/admin/articles',
      }),
    );
    expect(errors.some((e) => e.constraints?.menuConfigValid)).toBe(true);
  });

  it('rejects when permission key does not follow module:action format', async () => {
    const dto = makeDto({ key: 'invalid_key' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'key')).toBe(true);
  });
});
