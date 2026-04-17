import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  it('rejects when newPassword is the same as oldPassword', async () => {
    const dto = new ChangePasswordDto();
    dto.oldPassword = 'same-password';
    dto.newPassword = 'same-password';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('newPassword');
    expect(errors[0].constraints).toEqual({
      isDifferentFromOldPassword: 'newPassword must be different from oldPassword',
    });
  });

  it('accepts when newPassword differs from oldPassword', async () => {
    const dto = new ChangePasswordDto();
    dto.oldPassword = 'old-password';
    dto.newPassword = 'new-password';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
