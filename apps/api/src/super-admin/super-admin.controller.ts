import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";

@Controller("super-admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN")
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get("companies")
  getAllCompanies() {
    return this.superAdminService.getAllCompanies();
  }

  @Get("companies/:id")
  getCompanyById(@Param("id") id: string) {
    return this.superAdminService.getCompanyById(id);
  }

  @Get("companies/:id/stats")
  getCompanyStats(@Param("id") id: string) {
    return this.superAdminService.getCompanyStats(id);
  }

  @Post("companies")
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.superAdminService.createCompany(dto);
  }

  @Put("companies/:id")
  updateCompany(@Param("id") id: string, @Body() dto: UpdateCompanyDto) {
    return this.superAdminService.updateCompany(id, dto);
  }

  @Delete("companies/:id")
  deleteCompany(@Param("id") id: string) {
    return this.superAdminService.deleteCompany(id);
  }

  @Post("companies/:id/admin")
  createCompanyAdmin(
    @Param("id") companyId: string,
    @Body() body: { email: string; password: string },
  ) {
    return this.superAdminService.createCompanyAdmin(
      companyId,
      body.email,
      body.password,
    );
  }
}

