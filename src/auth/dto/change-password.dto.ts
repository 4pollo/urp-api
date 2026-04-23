import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
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
  @MaxLength(72)
  oldPassword: string;

  @ApiProperty({
    description: '新密码，6-72 位且不能与当前密码相同',
    minLength: 6,
    maxLength: 72,
    example: 'newPassword123',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  @IsDifferentFromOldPassword({
    message: 'newPassword must be different from oldPassword',
  })
  newPassword: string;
}
