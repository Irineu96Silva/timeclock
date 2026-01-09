import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { AuthenticatedUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logout(user.id);
    return { success: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return { success: true, message: "Senha alterada com sucesso" };
  }

  @Get("companies-by-email")
  async getCompaniesByEmail(@Query("email") email?: string) {
    if (!email) {
      return [];
    }

    // Busca usuários com esse email e retorna suas empresas
    const users = await this.authService.findUsersByEmail(email);
    
    // Filtra empresas válidas e remove duplicatas
    const companiesMap = new Map<string, { id: string; name: string }>();
    
    for (const user of users) {
      if (user.company && user.company.isActive) {
        const company = user.company;
        if (!companiesMap.has(company.id)) {
          companiesMap.set(company.id, {
            id: company.id,
            name: company.name,
          });
        }
      }
    }

    return Array.from(companiesMap.values());
  }
}
