import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { AuthTokens, JwtPayload, normalizeRole } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
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
