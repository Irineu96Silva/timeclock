import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { AdminDashboardService } from "./admin-dashboard.service";

@Controller("admin/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query() query: DashboardQueryDto) {
    return this.adminDashboardService.getSummary(user, query);
  }

  @Get("live")
  getLive(@CurrentUser() user: AuthenticatedUser, @Query() query: DashboardQueryDto) {
    return this.adminDashboardService.getLive(user, query);
  }
}
