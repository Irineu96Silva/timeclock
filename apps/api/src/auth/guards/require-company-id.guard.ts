import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

/**
 * Guard que valida se o usuário tem um companyId válido.
 * Usado para roles que SEMPRE precisam de companyId (ADMIN, EMPLOYEE, KIOSK)
 */
@Injectable()
export class RequireCompanyIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SUPER_ADMIN não precisa de companyId
    if (user?.role === "SUPER_ADMIN") {
      return true;
    }

    // Outros roles precisam ter um companyId válido
    if (!user?.companyId) {
      throw new ForbiddenException("CompanyId is required for this operation");
    }

    return true;
  }
}
