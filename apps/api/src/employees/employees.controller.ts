import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { SetEmployeePinDto } from "./dto/set-employee-pin.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeesService } from "./employees.service";

@Controller("employees")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  async create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.create(dto, user);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.findAll(user);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.update(id, dto, user);
  }

  @Post(":id/reset-password")
  async resetPassword(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.resetPassword(id, user);
  }

  @Post(":id/pin")
  async setPin(
    @Param("id") id: string,
    @Body() dto: SetEmployeePinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.setPin(id, dto, user);
  }

  @Post(":id/pin/reset")
  async resetPin(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.resetPin(id, user);
  }

  @Post(":id/qr/regenerate")
  async regenerateEmployeeQr(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.regenerateEmployeeQr(id, user);
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.delete(id, user);
  }
}
