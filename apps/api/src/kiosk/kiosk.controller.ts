import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { KioskService } from "./kiosk.service";

@Controller("kiosk/qr")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("KIOSK")
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Get("today")
  getTodayQr(@CurrentUser() user: AuthenticatedUser) {
    return this.kioskService.getTodayQr(user);
  }
}
