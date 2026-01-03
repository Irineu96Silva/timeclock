import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { KioskAuthService } from "./kiosk-auth.service";
import { KioskPinDto } from "./dto/kiosk-pin.dto";
import { KioskQrDto } from "./dto/kiosk-qr.dto";

@Controller("kiosk/auth")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("KIOSK")
export class KioskAuthController {
  constructor(private readonly kioskAuthService: KioskAuthService) {}

  @Post("pin")
  @Throttle({ default: { limit: 10, ttl: 60 } })
  authByPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: KioskPinDto) {
    return this.kioskAuthService.authByPin(user, dto);
  }

  @Post("qr")
  authByQr(@CurrentUser() user: AuthenticatedUser, @Body() dto: KioskQrDto) {
    return this.kioskAuthService.authByQr(user, dto);
  }
}
