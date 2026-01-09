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
    // Usa select explícito para evitar campos que não existem
    try {
      const companies = await this.prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              employees: true,
              events: true,
            },
          },
        },
      });
      
      // Busca settings separadamente para cada empresa
      const companiesWithSettings = await Promise.all(
        companies.map(async (company) => {
          try {
            const settings = await this.prisma.companySettings.findUnique({
              where: { companyId: company.id },
              select: {
                companyId: true,
                geofenceEnabled: true,
                geoRequired: true,
                geofenceLat: true,
                geofenceLng: true,
                geofenceRadiusMeters: true,
                maxAccuracyMeters: true,
                qrEnabled: true,
                punchFallbackMode: true,
              },
            });
            return {
              ...company,
              cnpj: null,
              phone: null,
              email: null,
              address: null,
              city: null,
              state: null,
              zipCode: null,
              isActive: true,
              updatedAt: null,
              settings,
            };
          } catch (error: any) {
            // Se falhar ao buscar settings, retorna sem eles
            return {
              ...company,
              cnpj: null,
              phone: null,
              email: null,
              address: null,
              city: null,
              state: null,
              zipCode: null,
              isActive: true,
              updatedAt: null,
              settings: null,
            };
          }
        })
      );
      
      return companiesWithSettings;
    } catch (error: any) {
      // Se falhar, tenta buscar apenas campos básicos
      if (error.message?.includes("no column")) {
        const companies = await this.prisma.company.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: {
              select: {
                users: true,
                employees: true,
                events: true,
              },
            },
          },
        });
        
        return companies.map((company: any) => ({
          ...company,
          cnpj: null,
          phone: null,
          email: null,
          address: null,
          city: null,
          state: null,
          zipCode: null,
          isActive: true,
          updatedAt: null,
          settings: null,
        }));
      }
      throw error;
    }
  }

  async getCompanyById(id: string) {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          createdAt: true,
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

      // Busca settings separadamente
      let settings = null;
      try {
        settings = await this.prisma.companySettings.findUnique({
          where: { companyId: id },
          select: {
            companyId: true,
            geofenceEnabled: true,
            geoRequired: true,
            geofenceLat: true,
            geofenceLng: true,
            geofenceRadiusMeters: true,
            maxAccuracyMeters: true,
            qrEnabled: true,
            punchFallbackMode: true,
          },
        });
      } catch (error: any) {
        // Se falhar, settings permanece null
        console.error("Erro ao buscar settings da empresa:", error.message);
      }

      return {
        ...company,
        cnpj: null,
        phone: null,
        email: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        isActive: true,
        updatedAt: null,
        settings,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Se falhar por causa de campos que não existem, tenta buscar apenas básicos
      if (error.message?.includes("no column")) {
        const company = await this.prisma.company.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        });

        if (!company) {
          throw new NotFoundException("Empresa não encontrada");
        }

        return {
          ...company,
          cnpj: null,
          phone: null,
          email: null,
          address: null,
          city: null,
          state: null,
          zipCode: null,
          isActive: true,
          updatedAt: null,
          _count: {
            users: 0,
            employees: 0,
            events: 0,
          },
          settings: null,
        };
      }
      throw error;
    }
  }

  async createCompany(dto: CreateCompanyDto) {
    // Verificar se CNPJ já existe (apenas se CNPJ foi fornecido e existe no banco)
    if (dto.cnpj) {
      try {
        const existing = await this.prisma.company.findFirst({
          where: { cnpj: dto.cnpj },
        });
        if (existing) {
          throw new ConflictException("CNPJ já cadastrado");
        }
      } catch (error: any) {
        // Se a coluna cnpj não existir, ignora a verificação
        if (error.message?.includes("no column") || error.message?.includes("cnpj")) {
          // Continua sem verificar CNPJ
        } else {
          throw error;
        }
      }
    }

    // Criar empresa com campos básicos primeiro
    const companyData: any = {
      name: dto.name,
    };

    // Adiciona campos opcionais apenas se foram fornecidos
    if (dto.cnpj !== undefined) companyData.cnpj = dto.cnpj;
    if (dto.phone !== undefined) companyData.phone = dto.phone;
    if (dto.email !== undefined) companyData.email = dto.email;
    if (dto.address !== undefined) companyData.address = dto.address;
    if (dto.city !== undefined) companyData.city = dto.city;
    if (dto.state !== undefined) companyData.state = dto.state;
    if (dto.zipCode !== undefined) companyData.zipCode = dto.zipCode;

    // Tenta adicionar isActive, se falhar cria sem ele
    let company;
    try {
      if (dto.isActive !== undefined) {
        companyData.isActive = dto.isActive;
      }
      company = await this.prisma.company.create({
        data: companyData,
      });
    } catch (error: any) {
      // Se isActive não existir, tenta sem ele
      if (error.message?.includes("isActive") || error.message?.includes("no column")) {
        delete companyData.isActive;
        company = await this.prisma.company.create({
          data: companyData,
        });
      } else {
        throw error;
      }
    }

    // Criar configurações padrão para a empresa (com fallback para campos básicos)
    try {
      // Tenta criar com todos os campos
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
    } catch (error: any) {
      // Se campos novos não existirem, cria apenas com campos básicos
      if (error.message?.includes("no column") || error.message?.includes("defaultWork")) {
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
          },
        });
      } else {
        throw error;
      }
    }

    return company;
  }

  async updateCompany(id: string, dto: UpdateCompanyDto) {
    // Verifica se empresa existe
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, cnpj: true },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    // Verificar se CNPJ já existe em outra empresa (apenas se cnpj foi fornecido e existe no banco)
    if (dto.cnpj && dto.cnpj !== company.cnpj) {
      try {
        const existing = await this.prisma.company.findFirst({
          where: {
            cnpj: dto.cnpj,
            id: { not: id },
          },
        });
        if (existing) {
          throw new ConflictException("CNPJ já cadastrado em outra empresa");
        }
      } catch (error: any) {
        // Se a coluna cnpj não existir, ignora a verificação
        if (error.message?.includes("no column") || error.message?.includes("cnpj")) {
          // Continua sem verificar CNPJ
        } else {
          throw error;
        }
      }
    }

    // Usa raw SQL para atualizar apenas campos que existem no banco
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (dto.name !== undefined) {
      updateFields.push(`"name" = ?`);
      updateValues.push(dto.name);
    }
    if (dto.cnpj !== undefined) {
      updateFields.push(`"cnpj" = ?`);
      updateValues.push(dto.cnpj);
    }
    if (dto.phone !== undefined) {
      updateFields.push(`"phone" = ?`);
      updateValues.push(dto.phone);
    }
    if (dto.email !== undefined) {
      updateFields.push(`"email" = ?`);
      updateValues.push(dto.email);
    }
    if (dto.address !== undefined) {
      updateFields.push(`"address" = ?`);
      updateValues.push(dto.address);
    }
    if (dto.city !== undefined) {
      updateFields.push(`"city" = ?`);
      updateValues.push(dto.city);
    }
    if (dto.state !== undefined) {
      updateFields.push(`"state" = ?`);
      updateValues.push(dto.state);
    }
    if (dto.zipCode !== undefined) {
      updateFields.push(`"zipCode" = ?`);
      updateValues.push(dto.zipCode);
    }
    if (dto.isActive !== undefined) {
      updateFields.push(`"isActive" = ?`);
      updateValues.push(dto.isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      // Nada para atualizar, retorna empresa atual
      return company;
    }

    // Adiciona updatedAt e id
    updateFields.push(`"updatedAt" = datetime('now')`);
    updateValues.push(id);

    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Company" SET ${updateFields.join(", ")} WHERE "id" = ?`,
        ...updateValues
      );

      // Busca empresa atualizada
      return await this.getCompanyById(id);
    } catch (error: any) {
      // Se falhar por causa de campos que não existem, tenta atualizar apenas campos básicos
      if (error.message?.includes("no column")) {
        const basicFields: string[] = [];
        const basicValues: any[] = [];

        if (dto.name !== undefined) {
          basicFields.push(`"name" = ?`);
          basicValues.push(dto.name);
        }
        basicFields.push(`"updatedAt" = datetime('now')`);
        basicValues.push(id);

        await this.prisma.$executeRawUnsafe(
          `UPDATE "Company" SET ${basicFields.join(", ")} WHERE "id" = ?`,
          ...basicValues
        );

        return await this.getCompanyById(id);
      }
      throw error;
    }
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

  async getCompanyUsers(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return users;
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
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
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

