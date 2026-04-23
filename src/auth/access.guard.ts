import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions/permissions.service';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_ROLES_KEY,
} from './access.decorator';
import { SYSTEM_ROLES } from './system-roles';
import { AuthenticatedRequest } from './auth-request.interface';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Access denied');
    }

    const { roles, permissions } =
      await this.permissionsService.getUserPermissions(userId, request);

    if (roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      return true;
    }

    if (
      requiredRoles.length > 0 &&
      !requiredRoles.some((role) => roles.includes(role))
    ) {
      throw new ForbiddenException('Insufficient role');
    }

    if (
      requiredPermissions.length > 0 &&
      !requiredPermissions.some((permission) =>
        permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}
