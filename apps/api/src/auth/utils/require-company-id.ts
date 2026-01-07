import { ForbiddenException } from "@nestjs/common";
import { AuthenticatedUser } from "../auth.types";

/**
 * Garante que o usuário tem um companyId válido.
 * Lança erro se não tiver (SUPER_ADMIN não deveria chamar esta função).
 * Usado para validação em tempo de execução.
 */
export function requireCompanyId(user: AuthenticatedUser): string {
  if (!user.companyId) {
    throw new ForbiddenException(
      "CompanyId is required for this operation. SUPER_ADMIN users cannot perform this action."
    );
  }
  return user.companyId;
}
