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
import { normalizeCnpj, isValidCnpj, isValidCnpjLength } from "../utils/cnpj-validator";

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllCompanies() {
    // Usa raw SQL para buscar empresas incluindo cnpj e outros campos
    try {
      // Busca empresas usando raw SQL para incluir cnpj e outros campos opcionais
      const companies = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        name: string;
        cnpj: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        city: string | null;
        state: string | null;
        zipCode: string | null;
        isActive: number; // SQLite retorna boolean como 0/1
        createdAt: Date;
        updatedAt: Date | null;
      }>>(
        `SELECT id, name, cnpj, phone, email, address, city, state, "zipCode", "isActive", "createdAt", "updatedAt" 
         FROM "Company" 
         ORDER BY "createdAt" DESC`
      );

      // Busca contadores e settings para cada empresa
      const companiesWithDetails = await Promise.all(
        companies.map(async (company) => {
          try {
            const [usersCount, employeesCount, eventsCount, settings] = await Promise.all([
              this.prisma.user.count({ where: { companyId: company.id } }),
              this.prisma.employeeProfile.count({ where: { companyId: company.id } }),
              this.prisma.timeClockEvent.count({ where: { companyId: company.id } }),
              this.prisma.companySettings.findUnique({
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
              }).catch(() => null),
            ]);

            return {
              id: company.id,
              name: company.name,
              cnpj: company.cnpj,
              phone: company.phone,
              email: company.email,
              address: company.address,
              city: company.city,
              state: company.state,
              zipCode: company.zipCode,
              isActive: Boolean(company.isActive),
              createdAt: company.createdAt,
              updatedAt: company.updatedAt,
              _count: {
                users: usersCount,
                employees: employeesCount,
                events: eventsCount,
              },
              settings,
            };
          } catch (error: any) {
            // Se falhar, retorna com valores padrão
            return {
              id: company.id,
              name: company.name,
              cnpj: company.cnpj,
              phone: company.phone,
              email: company.email,
              address: company.address,
              city: company.city,
              state: company.state,
              zipCode: company.zipCode,
              isActive: Boolean(company.isActive),
              createdAt: company.createdAt,
              updatedAt: company.updatedAt,
              _count: {
                users: 0,
                employees: 0,
                events: 0,
              },
              settings: null,
            };
          }
        })
      );

      return companiesWithDetails;
    } catch (error: any) {
      // Se falhar por causa de campos que não existem, tenta buscar apenas campos básicos
      if (error.message?.includes("no column") || error.message?.includes("no such column")) {
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
      // Busca empresa usando raw SQL para incluir cnpj e outros campos opcionais
      const companyResult = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        name: string;
        cnpj: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        city: string | null;
        state: string | null;
        zipCode: string | null;
        isActive: number;
        createdAt: Date;
        updatedAt: Date | null;
      }>>(
        `SELECT id, name, cnpj, phone, email, address, city, state, "zipCode", "isActive", "createdAt", "updatedAt" 
         FROM "Company" 
         WHERE id = ? 
         LIMIT 1`,
        id
      );

      if (!companyResult || companyResult.length === 0) {
        throw new NotFoundException("Empresa não encontrada");
      }

      const company = companyResult[0];

      // Busca contadores e settings
      const [usersCount, employeesCount, eventsCount, settings] = await Promise.all([
        this.prisma.user.count({ where: { companyId: id } }),
        this.prisma.employeeProfile.count({ where: { companyId: id } }),
        this.prisma.timeClockEvent.count({ where: { companyId: id } }),
        this.prisma.companySettings.findUnique({
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
        }).catch(() => null),
      ]);

      return {
        id: company.id,
        name: company.name,
        cnpj: company.cnpj,
        phone: company.phone,
        email: company.email,
        address: company.address,
        city: company.city,
        state: company.state,
        zipCode: company.zipCode,
        isActive: Boolean(company.isActive),
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        _count: {
          users: usersCount,
          employees: employeesCount,
          events: eventsCount,
        },
        settings,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Se falhar por causa de campos que não existem, tenta buscar apenas básicos
      if (error.message?.includes("no column") || error.message?.includes("no such column")) {
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
    // Normalizar e validar CNPJ se fornecido
    let normalizedCnpj: string | null = null;
    if (dto.cnpj) {
      normalizedCnpj = normalizeCnpj(dto.cnpj);
      if (normalizedCnpj && !isValidCnpjLength(normalizedCnpj)) {
        throw new BadRequestException("CNPJ deve conter 14 dígitos");
      }
      if (normalizedCnpj && !isValidCnpj(normalizedCnpj)) {
        throw new BadRequestException("CNPJ inválido");
      }
    }

    // Verificar se CNPJ já existe (usando raw SQL para evitar erro se coluna não existir)
    if (normalizedCnpj) {
      try {
        const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "Company" WHERE cnpj = ? LIMIT 1`,
          normalizedCnpj
        );
        if (existing && existing.length > 0) {
          throw new ConflictException("CNPJ já cadastrado");
        }
      } catch (error: any) {
        // Se for ConflictException, propaga
        if (error instanceof ConflictException) {
          throw error;
        }
        // Se a coluna cnpj não existir, ignora a verificação (pode não ter sido criada ainda)
        if (error.message?.includes("no column") || error.message?.includes("no such column")) {
          // Continua sem verificar CNPJ - a migration vai criar a coluna depois
        } else {
          throw error;
        }
      }
    }

    // Usa raw SQL para criar empresa incluindo cnpj e outros campos
    const companyId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const insertFields: string[] = ['id', 'name', '"createdAt"', '"updatedAt"'];
    const insertValues: any[] = [companyId, dto.name, "datetime('now')", "datetime('now')"];

    // Adiciona campos opcionais apenas se foram fornecidos
    if (normalizedCnpj !== null && normalizedCnpj !== undefined) {
      insertFields.push('cnpj');
      insertValues.push(normalizedCnpj);
    }
    if (dto.phone !== undefined && dto.phone !== null) {
      insertFields.push('phone');
      insertValues.push(dto.phone.trim() || null);
    }
    if (dto.email !== undefined && dto.email !== null) {
      insertFields.push('email');
      insertValues.push(dto.email.trim().toLowerCase() || null);
    }
    if (dto.address !== undefined && dto.address !== null) {
      insertFields.push('address');
      insertValues.push(dto.address.trim() || null);
    }
    if (dto.city !== undefined && dto.city !== null) {
      insertFields.push('city');
      insertValues.push(dto.city.trim() || null);
    }
    if (dto.state !== undefined && dto.state !== null) {
      insertFields.push('state');
      insertValues.push(dto.state.trim() || null);
    }
    if (dto.zipCode !== undefined && dto.zipCode !== null) {
      insertFields.push('"zipCode"');
      insertValues.push(dto.zipCode.trim() || null);
    }
    if (dto.isActive !== undefined) {
      insertFields.push('"isActive"');
      insertValues.push(dto.isActive ? 1 : 0);
    }

    try {
      // Monta arrays de campos e valores para inserção
      const fields: string[] = ['id', 'name', '"createdAt"', '"updatedAt"'];
      const values: any[] = [companyId, dto.name];

      // Adiciona campos opcionais se fornecidos
      if (normalizedCnpj !== null && normalizedCnpj !== undefined) {
        fields.push('cnpj');
        values.push(normalizedCnpj);
      }
      if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim()) {
        fields.push('phone');
        values.push(dto.phone.trim());
      }
      if (dto.email !== undefined && dto.email !== null && dto.email.trim()) {
        fields.push('email');
        values.push(dto.email.trim().toLowerCase());
      }
      if (dto.address !== undefined && dto.address !== null && dto.address.trim()) {
        fields.push('address');
        values.push(dto.address.trim());
      }
      if (dto.city !== undefined && dto.city !== null && dto.city.trim()) {
        fields.push('city');
        values.push(dto.city.trim());
      }
      if (dto.state !== undefined && dto.state !== null && dto.state.trim()) {
        fields.push('state');
        values.push(dto.state.trim());
      }
      if (dto.zipCode !== undefined && dto.zipCode !== null && dto.zipCode.trim()) {
        fields.push('"zipCode"');
        values.push(dto.zipCode.trim());
      }
      if (dto.isActive !== undefined) {
        fields.push('"isActive"');
        values.push(dto.isActive ? 1 : 0);
      }

      // Constrói a query SQL - createdAt e updatedAt usam datetime('now'), os outros usam ?
      const placeholders = fields.map((field, index) => {
        if (field === '"createdAt"' || field === '"updatedAt"') {
          return "datetime('now')";
        }
        return '?';
      });

      // Filtra valores removendo os que correspondem a datetime('now')
      const sqlValues = values.filter((_, index) => {
        const field = fields[index];
        return field !== '"createdAt"' && field !== '"updatedAt"';
      });

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "Company" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
        ...sqlValues
      );
    } catch (error: any) {
      // Se falhar por causa de campos que não existem, tenta criar apenas com campos básicos
      if (error.message?.includes("no column") || error.message?.includes("no such column")) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "Company" (id, name, "createdAt", "updatedAt") VALUES (?, ?, datetime('now'), datetime('now'))`,
          companyId,
          dto.name
        );
      } else {
        throw error;
      }
    }

    // Busca a empresa criada usando getCompanyById
    const company = await this.getCompanyById(companyId);

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
    // Verifica se empresa existe usando raw SQL
    const companyResult = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      name: string;
      cnpj: string | null;
    }>>(
      `SELECT id, name, cnpj FROM "Company" WHERE id = ? LIMIT 1`,
      id
    );

    if (!companyResult || companyResult.length === 0) {
      throw new NotFoundException("Empresa não encontrada");
    }

    const company = companyResult[0];

    // Normalizar e validar CNPJ se fornecido
    let normalizedCnpj: string | null = null;
    if (dto.cnpj !== undefined) {
      if (dto.cnpj === null || dto.cnpj === "") {
        normalizedCnpj = null;
      } else {
        normalizedCnpj = normalizeCnpj(dto.cnpj);
        if (normalizedCnpj && !isValidCnpjLength(normalizedCnpj)) {
          throw new BadRequestException("CNPJ deve conter 14 dígitos");
        }
        if (normalizedCnpj && !isValidCnpj(normalizedCnpj)) {
          throw new BadRequestException("CNPJ inválido");
        }
      }
    }

    // Verificar se CNPJ já existe em outra empresa (usando raw SQL)
    if (normalizedCnpj !== null && normalizedCnpj !== company.cnpj) {
      try {
        const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "Company" WHERE cnpj = ? AND id != ? LIMIT 1`,
          normalizedCnpj,
          id
        );
        if (existing && existing.length > 0) {
          throw new ConflictException("CNPJ já cadastrado em outra empresa");
        }
      } catch (error: any) {
        // Se for ConflictException, propaga
        if (error instanceof ConflictException) {
          throw error;
        }
        // Se a coluna cnpj não existir, ignora a verificação
        if (error.message?.includes("no column") || error.message?.includes("no such column")) {
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
      updateValues.push(dto.name.trim());
    }
    if (dto.cnpj !== undefined) {
      updateFields.push(`"cnpj" = ?`);
      updateValues.push(normalizedCnpj);
    }
    if (dto.phone !== undefined) {
      updateFields.push(`"phone" = ?`);
      updateValues.push(dto.phone?.trim() || null);
    }
    if (dto.email !== undefined) {
      updateFields.push(`"email" = ?`);
      updateValues.push(dto.email?.trim().toLowerCase() || null);
    }
    if (dto.address !== undefined) {
      updateFields.push(`"address" = ?`);
      updateValues.push(dto.address?.trim() || null);
    }
    if (dto.city !== undefined) {
      updateFields.push(`"city" = ?`);
      updateValues.push(dto.city?.trim() || null);
    }
    if (dto.state !== undefined) {
      updateFields.push(`"state" = ?`);
      updateValues.push(dto.state?.trim() || null);
    }
    if (dto.zipCode !== undefined) {
      updateFields.push(`"zipCode" = ?`);
      updateValues.push(dto.zipCode?.trim() || null);
    }
    if (dto.isActive !== undefined) {
      updateFields.push(`"isActive" = ?`);
      updateValues.push(dto.isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      // Nada para atualizar, retorna empresa atual
      return await this.getCompanyById(id);
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
      if (error.message?.includes("no column") || error.message?.includes("no such column")) {
        const basicFields: string[] = [];
        const basicValues: any[] = [];

        if (dto.name !== undefined) {
          basicFields.push(`"name" = ?`);
          basicValues.push(dto.name.trim());
        }
        basicFields.push(`"updatedAt" = datetime('now')`);
        basicValues.push(id);

        if (basicFields.length > 1) { // Mais que apenas updatedAt
          await this.prisma.$executeRawUnsafe(
            `UPDATE "Company" SET ${basicFields.join(", ")} WHERE "id" = ?`,
            ...basicValues
          );
        }

        return await this.getCompanyById(id);
      }
      throw error;
    }
  }

  async deleteCompany(id: string) {
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
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    // Verificar se email já existe usando select explícito
    const existing = await this.prisma.user.findFirst({
      where: {
        companyId,
        email: email.toLowerCase().trim(),
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
      },
    });

    if (existing) {
      throw new ConflictException("Email já cadastrado nesta empresa");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Usa raw SQL para criar usuário sem tentar incluir username
    const userId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, "companyId", email, "passwordHash", role, "isActive", "createdAt", "updatedAt") 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      userId,
      companyId,
      email.toLowerCase().trim(),
      passwordHash,
      "ADMIN",
      true
    );

    // Busca o usuário criado com select explícito
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      throw new Error("Falha ao criar usuário admin");
    }

    return user;
  }

  async getCompanyStats(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
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

