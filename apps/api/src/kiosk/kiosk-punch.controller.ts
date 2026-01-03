import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { KioskPunchService } from "./kiosk-punch.service";
import { KioskPunchDto } from "./dto/kiosk-punch.dto";

@Controller("kiosk")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("KIOSK")
export class KioskPunchController {
  constructor(private readonly kioskPunchService: KioskPunchService) {}

  @Post("punch")
  punch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KioskPunchDto,
    @Req() req: any,
  ) {
    return this.kioskPunchService.punch(user, dto, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }
}
