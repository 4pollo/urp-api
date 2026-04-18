import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'isDifferentFromOldPassword' })
class IsDifferentFromOldPasswordConstraint
  implements ValidatorConstraintInterface
{
  validate(newPassword: string, args: ValidationArguments) {
    const object = args.object as ChangePasswordDto;
    return newPassword !== object.oldPassword;
  }
}

function IsDifferentFromOldPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsDifferentFromOldPasswordConstraint,
    });
  };
}

export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  oldPassword: string;

  @ApiProperty({
    description: '新密码，至少 6 位且不能与当前密码相同',
    minLength: 6,
    example: 'newPassword123',
  })
  @IsString()
  @MinLength(6)
  @IsDifferentFromOldPassword({
    message: 'newPassword must be different from oldPassword',
  })
  newPassword: string;
}
