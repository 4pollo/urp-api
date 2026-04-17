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
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(6)
  @IsDifferentFromOldPassword({
    message: 'newPassword must be different from oldPassword',
  })
  newPassword: string;
}
