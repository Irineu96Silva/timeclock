import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AuthTokens, JwtPayload, normalizeRole } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    let user: any = null;

    // Busca usuário por email ou username
    if (dto.email) {
      const whereClause: any = {
        email: dto.email.toLowerCase().trim(),
        isActive: true,
      };

      // Se companyId foi fornecido, adiciona ao where (multi-tenant)
      if (dto.companyId) {
        whereClause.companyId = dto.companyId;
      }

      user = await this.prisma.user.findFirst({
        where: whereClause,
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          isActive: true,
          companyId: true,
          refreshTokenHash: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Busca company separadamente se necessário
      if (user && user.companyId) {
        try {
          const company = await this.prisma.company.findUnique({
            where: { id: user.companyId },
            select: {
              id: true,
              name: true,
            },
          });
          // Tenta buscar isActive usando raw SQL se necessário
          if (company) {
            try {
              const companyStatus = await this.prisma.$queryRawUnsafe<Array<{ isActive: number }>>(
                `SELECT "isActive" FROM "Company" WHERE "id" = ? LIMIT 1`,
                user.companyId
              );
              user.company = {
                ...company,
                isActive: companyStatus?.[0]?.isActive === 1,
              };
            } catch {
              // Se isActive não existir, assume que está ativa
              user.company = {
                ...company,
                isActive: true,
              };
            }
          } else {
            user.company = null;
          }
        } catch (error: any) {
          // Se falhar, tenta buscar apenas campos básicos
          user.company = null;
        }
      } else {
        user.company = null;
      }
    } else if (dto.username) {
      // Busca por username usando raw SQL (coluna pode não existir ainda)
      try {
        const whereConditions: string[] = ['"isActive" = 1'];
        const params: any[] = [];
        
        whereConditions.push('"username" = ?');
        params.push(dto.username.toLowerCase().trim());

        if (dto.companyId) {
          whereConditions.push('"companyId" = ?');
          params.push(dto.companyId);
        }

        const users = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id, email, "passwordHash", role, "isActive", "companyId", "refreshTokenHash", "createdAt", "updatedAt" 
           FROM "User" 
           WHERE ${whereConditions.join(' AND ')} 
           LIMIT 1`,
          ...params
        );

        if (users && users.length > 0) {
          user = users[0];
          // Busca company separadamente
          if (user.companyId) {
            try {
              const company = await this.prisma.company.findUnique({
                where: { id: user.companyId },
                select: {
                  id: true,
                  name: true,
                },
              });
              // Tenta buscar isActive usando raw SQL se necessário
              if (company) {
                try {
                  const companyStatus = await this.prisma.$queryRawUnsafe<Array<{ isActive: number }>>(
                    `SELECT "isActive" FROM "Company" WHERE "id" = ? LIMIT 1`,
                    user.companyId
                  );
                  user.company = {
                    ...company,
                    isActive: companyStatus?.[0]?.isActive === 1,
                  };
                } catch {
                  // Se isActive não existir, assume que está ativa
                  user.company = {
                    ...company,
                    isActive: true,
                  };
                }
              } else {
                user.company = null;
              }
            } catch (error: any) {
              user.company = null;
            }
          } else {
            user.company = null;
          }
        }
      } catch (error: any) {
        // Se a coluna username não existir, retorna erro
        if (error.message?.includes("no such column") || error.message?.includes("username")) {
          throw new UnauthorizedException("Login por username ainda não está disponível");
        }
        throw error;
      }
    } else {
      throw new UnauthorizedException("Email ou username é obrigatório");
    }

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    // Verifica se empresa está ativa (se houver e se o campo existir)
    if (user.company && user.company.isActive === false) {
      throw new UnauthorizedException("Empresa inativa");
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Senha incorreta");
    }

    const role = normalizeRole(user.role);
    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      role,
      companyId: user.companyId ?? undefined, // Converte null para undefined
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refresh_token, 10),
      },
    });

    return tokens;
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(dto.refresh_token);
    if (!payload?.sub) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        companyId: true,
        refreshTokenHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const refreshMatches = await bcrypt.compare(dto.refresh_token, user.refreshTokenHash);
    if (!refreshMatches) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const role = normalizeRole(user.role);
    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      role,
      companyId: user.companyId ?? undefined, // Converte null para undefined
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refresh_token, 10),
      },
    });

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async findUsersByEmail(email: string) {
    const users = await this.prisma.user.findMany({
      where: {
        email: email.toLowerCase().trim(),
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Busca companies separadamente para evitar problema com isActive
    const usersWithCompanies = await Promise.all(
      users.map(async (u) => {
        if (u.companyId) {
          try {
            const company = await this.prisma.company.findUnique({
              where: { id: u.companyId },
              select: {
                id: true,
                name: true,
              },
            });
            // Tenta buscar isActive usando raw SQL
            if (company) {
              try {
                const companyStatus = await this.prisma.$queryRawUnsafe<Array<{ isActive: number }>>(
                  `SELECT "isActive" FROM "Company" WHERE "id" = ? LIMIT 1`,
                  u.companyId
                );
                return {
                  ...u,
                  company: {
                    ...company,
                    isActive: companyStatus?.[0]?.isActive === 1,
                  },
                };
              } catch {
                return {
                  ...u,
                  company: {
                    ...company,
                    isActive: true,
                  },
                };
              }
            }
          } catch {
            // Ignora erro
          }
        }
        return {
          ...u,
          company: null,
        };
      })
    );

    return usersWithCompanies;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    const currentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      throw new UnauthorizedException("Senha atual incorreta");
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessSecret = this.configService.getOrThrow<string>("JWT_ACCESS_SECRET");
    const refreshSecret = this.configService.getOrThrow<string>("JWT_REFRESH_SECRET");
    const accessExpiresIn = this.configService.getOrThrow<string>("JWT_ACCESS_EXPIRES_IN");
    const refreshExpiresIn = this.configService.getOrThrow<string>("JWT_REFRESH_EXPIRES_IN");

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { access_token, refresh_token };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
