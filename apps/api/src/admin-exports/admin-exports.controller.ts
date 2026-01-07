import { Controller, Get, Post, Param, Query, Body, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ExportEmployeeQueryDto } from "./dto/export-employee-query.dto";
import { AdminExportsService } from "./admin-exports.service";

@Controller("admin/exports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminExportsController {
  constructor(private readonly adminExportsService: AdminExportsService) {}

  @Get("employees/:employeeId.csv")
  async exportEmployeeCsv(
    @Param("employeeId") employeeId: string,
    @Query() query: ExportEmployeeQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.adminExportsService.buildEmployeeCsv(user, employeeId, {
      from: query.from,
      to: query.to,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get("employees/:employeeId.xlsx")
  async exportEmployeeExcel(
    @Param("employeeId") employeeId: string,
    @Query() query: ExportEmployeeQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.adminExportsService.buildEmployeeExcel(
      user,
      employeeId,
      {
        from: query.from,
        to: query.to,
      },
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post("bulk.xlsx")
  async exportBulkExcel(
    @Body() body: { employeeIds: string[]; from?: string; to?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.adminExportsService.buildBulkExcel(
      user,
      body.employeeIds,
      {
        from: body.from,
        to: body.to,
      },
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
