import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import bcrypt from "bcrypt";

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllCompanies() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            employees: true,
            events: true,
          },
        },
        settings: true,
      },
    });
  }

  async getCompanyById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        settings: true,
        _count: {
          select: {
            users: true,
            employees: true,
            events: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    return company;
  }

  async createCompany(dto: CreateCompanyDto) {
    // Verificar se CNPJ já existe
    if (dto.cnpj) {
      const existing = await this.prisma.company.findFirst({
        where: { cnpj: dto.cnpj },
      });
      if (existing) {
        throw new ConflictException("CNPJ já cadastrado");
      }
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        cnpj: dto.cnpj,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        isActive: dto.isActive ?? true,
      },
    });

    // Criar configurações padrão para a empresa
    await this.prisma.companySettings.create({
      data: {
        companyId: company.id,
        geofenceEnabled: true,
        geoRequired: true,
        geofenceLat: 0,
        geofenceLng: 0,
        geofenceRadiusMeters: 200,
        maxAccuracyMeters: 100,
        qrEnabled: true,
        punchFallbackMode: "GEO_OR_QR",
        qrSecret: "",
        kioskDeviceLabel: "",
        defaultWorkStartTime: "08:00",
        defaultBreakStartTime: "12:00",
        defaultBreakEndTime: "13:00",
        defaultWorkEndTime: "17:00",
        defaultToleranceMinutes: 5,
        defaultTimezone: "America/Sao_Paulo",
      },
    });

    return company;
  }

  async updateCompany(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    // Verificar se CNPJ já existe em outra empresa
    if (dto.cnpj && dto.cnpj !== company.cnpj) {
      const existing = await this.prisma.company.findFirst({
        where: {
          cnpj: dto.cnpj,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException("CNPJ já cadastrado em outra empresa");
      }
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        cnpj: dto.cnpj,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        isActive: dto.isActive,
      },
    });
  }

  async deleteCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            employees: true,
            events: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    // Verificar se há dados associados
    if (
      company._count.users > 0 ||
      company._count.employees > 0 ||
      company._count.events > 0
    ) {
      throw new BadRequestException(
        "Não é possível excluir empresa com usuários, funcionários ou registros de ponto associados",
      );
    }

    // Deletar configurações primeiro
    await this.prisma.companySettings.deleteMany({
      where: { companyId: id },
    });

    // Deletar empresa
    await this.prisma.company.delete({
      where: { id },
    });

    return { message: "Empresa excluída com sucesso" };
  }

  async createCompanyAdmin(companyId: string, email: string, password: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    // Verificar se email já existe
    const existing = await this.prisma.user.findFirst({
      where: {
        companyId,
        email: email.toLowerCase().trim(),
      },
    });

    if (existing) {
      throw new ConflictException("Email já cadastrado nesta empresa");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        companyId,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });

    return user;
  }

  async getCompanyStats(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    const [users, employees, events, recentEvents] = await Promise.all([
      this.prisma.user.count({
        where: { companyId, isActive: true },
      }),
      this.prisma.employeeProfile.count({
        where: { companyId, isActive: true },
      }),
      this.prisma.timeClockEvent.count({
        where: { companyId },
      }),
      this.prisma.timeClockEvent.count({
        where: {
          companyId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias
          },
        },
      }),
    ]);

    return {
      company,
      stats: {
        activeUsers: users,
        activeEmployees: employees,
        totalEvents: events,
        eventsLast30Days: recentEvents,
      },
    };
  }
}

