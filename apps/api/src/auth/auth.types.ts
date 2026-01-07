import { UnauthorizedException } from "@nestjs/common";

export const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "EMPLOYEE", "KIOSK"] as const;
export type UserRole = (typeof ALLOWED_ROLES)[number];

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  companyId?: string; // Opcional para SUPER_ADMIN
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  companyId?: string; // Opcional para SUPER_ADMIN
};

export function normalizeRole(role: string): UserRole {
  const normalized = role.trim().toUpperCase();
  if (!ALLOWED_ROLES.includes(normalized as UserRole)) {
    throw new UnauthorizedException("Invalid user role");
  }
  return normalized as UserRole;
}
