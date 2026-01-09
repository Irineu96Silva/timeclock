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
    // Busca usuário por email ou username
    const whereClause: any = {
      isActive: true,
    };

    if (dto.email) {
      whereClause.email = dto.email.toLowerCase().trim();
    } else if (dto.username) {
      whereClause.username = dto.username.toLowerCase().trim();
    } else {
      throw new UnauthorizedException("Email ou username é obrigatório");
    }

    // Se companyId foi fornecido, adiciona ao where (multi-tenant)
    if (dto.companyId) {
      whereClause.companyId = dto.companyId;
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    // Verifica se empresa está ativa (se houver)
    if (user.company && !user.company.isActive) {
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
    return this.prisma.user.findMany({
      where: {
        email: email.toLowerCase().trim(),
        isActive: true,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
