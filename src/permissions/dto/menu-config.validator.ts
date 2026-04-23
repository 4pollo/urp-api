import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

export interface MenuConfigShape {
  showInMenu?: boolean;
  menuLabel?: string | null;
  menuPath?: string | null;
}

export function validateMenuConfig(config: MenuConfigShape): string | null {
  if (!config.showInMenu) {
    return null;
  }
  if (!config.menuLabel || config.menuLabel.trim().length === 0) {
    return 'menuLabel is required when showInMenu is true';
  }
  if (!config.menuPath || config.menuPath.trim().length === 0) {
    return 'menuPath is required when showInMenu is true';
  }
  if (!config.menuPath.startsWith('/')) {
    return 'menuPath must start with "/"';
  }
  return null;
}

@ValidatorConstraint({ name: 'menuConfigValid', async: false })
class MenuConfigValidConstraint implements ValidatorConstraintInterface {
  private lastError: string | null = null;

  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as MenuConfigShape;
    this.lastError = validateMenuConfig(dto);
    return this.lastError === null;
  }

  defaultMessage(): string {
    return this.lastError || 'menu configuration is invalid';
  }
}

export function IsValidMenuConfig(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: MenuConfigValidConstraint,
    });
  };
}
