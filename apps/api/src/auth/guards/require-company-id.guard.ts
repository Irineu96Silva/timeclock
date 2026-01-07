import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";

/**
 * Guard que valida se o usuário tem um companyId válido.
 * Usado para roles que SEMPRE precisam de companyId (ADMIN, EMPLOYEE, KIOSK)
 */
@Injectable()
export class RequireCompanyIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Se não há usuário, é problema de autenticação (401)
    if (!user) {
      throw new UnauthorizedException("Usuário não autenticado");
    }

    // SUPER_ADMIN não precisa de companyId
    if (user.role === "SUPER_ADMIN") {
      return true;
    }

    // Outros roles precisam ter um companyId válido
    if (!user.companyId) {
      throw new ForbiddenException("CompanyId is required for this operation");
    }

    return true;
  }
}
