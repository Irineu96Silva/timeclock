import { BadRequestException, Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RequireCompanyIdGuard } from "../auth/guards/require-company-id.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { AdminSettingsService } from "./admin-settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

@Controller("admin/settings")
@UseGuards(JwtAuthGuard, RolesGuard, RequireCompanyIdGuard)
@Roles("ADMIN")
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException("CompanyId é obrigatório");
    }
    return this.adminSettingsService.getSettings(user.companyId);
  }

  @Patch()
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingsDto) {
    return this.adminSettingsService.updateSettings(user.companyId!, dto);
  }

  @Post("qr/regenerate-secret")
  regenerateQrSecret(@CurrentUser() user: AuthenticatedUser) {
    return this.adminSettingsService.regenerateQrSecret(user.companyId!);
  }
}
