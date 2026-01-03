import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { HistoryQueryDto } from "./dto/history-query.dto";
import { PunchDto } from "./dto/punch.dto";
import { TimeClockService } from "./timeclock.service";

@Controller("timeclock")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "EMPLOYEE")
export class TimeClockController {
  constructor(private readonly timeClockService: TimeClockService) {}

  @Post("punch")
  punch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PunchDto,
    @Req() req: any,
  ) {
    return this.timeClockService.punch(user, dto, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @Get("me/today")
  async getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.timeClockService.getToday(user);
  }

  @Get("me/history")
  async getHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: HistoryQueryDto) {
    return this.timeClockService.getHistory(user, query);
  }
}
