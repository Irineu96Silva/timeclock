import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { CreateKioskUserDto } from "./dto/create-kiosk-user.dto";
import { AdminKioskService } from "./admin-kiosk.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminKioskController {
  constructor(private readonly adminKioskService: AdminKioskService) {}

  @Post("kiosk-user")
  createKioskUser(@Body() dto: CreateKioskUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.adminKioskService.createKioskUser(dto, user);
  }
}
