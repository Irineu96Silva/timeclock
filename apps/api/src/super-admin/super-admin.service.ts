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
    // Busca empresas usando apenas campos básicos que sempre existem
    try {
      const companies = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        name: string;
        createdAt: Date;
      }>>(
        `SELECT id, name, "createdAt" 
         FROM "Company" 
         ORDER BY "createdAt" DESC`
      );

      // Busca campos opcionais e contadores para cada empresa
      const companiesWithDetails = await Promise.all(
        companies.map(async (company) => {
          try {
            // Tenta buscar campos opcionais individualmente (podem não existir)
            let cnpj: string | null = null;
            let phone: string | null = null;
            let email: string | null = null;
            let address: string | null = null;
            let city: string | null = null;
            let state: string | null = null;
            let zipCode: string | null = null;
            let isActive: number = 1;
            let updatedAt: Date | null = null;

            // Tenta buscar campos opcionais individualmente para evitar erro se algum não existir
            // isActive
            try {
              const isActiveResult = await this.prisma.$queryRawUnsafe<Array<{ isActive: number }>>(
                `SELECT "isActive" FROM "Company" WHERE id = ? LIMIT 1`,
                company.id
              );
              if (isActiveResult && isActiveResult.length > 0) {
                isActive = isActiveResult[0].isActive ?? 1;
              }
            } catch {
              // isActive não existe, mantém padrão
            }

            // cnpj
            try {
              const cnpjResult = await this.prisma.$queryRawUnsafe<Array<{ cnpj: string | null }>>(
                `SELECT cnpj FROM "Company" WHERE id = ? LIMIT 1`,
                company.id
              );
              if (cnpjResult && cnpjResult.length > 0) {
                cnpj = cnpjResult[0].cnpj ?? null;
              }
            } catch {
              // cnpj não existe
            }

            // phone, email, address, city, state, zipCode (tenta todos de uma vez já que são opcionais)
            try {
              const contactResult = await this.prisma.$queryRawUnsafe<Array<{
                phone: string | null;
                email: string | null;
                address: string | null;
                city: string | null;
                state: string | null;
                zipCode: string | null;
              }>>(
                `SELECT phone, email, address, city, state, "zipCode" FROM "Company" WHERE id = ? LIMIT 1`,
                company.id
              );
              if (contactResult && contactResult.length > 0) {
                phone = contactResult[0].phone ?? null;
                email = contactResult[0].email ?? null;
                address = contactResult[0].address ?? null;
                city = contactResult[0].city ?? null;
                state = contactResult[0].state ?? null;
                zipCode = contactResult[0].zipCode ?? null;
              }
            } catch {
              // Campos de contato não existem
            }

            // updatedAt
            try {
              const updatedAtResult = await this.prisma.$queryRawUnsafe<Array<{ updatedAt: Date | null }>>(
                `SELECT "updatedAt" FROM "Company" WHERE id = ? LIMIT 1`,
                company.id
              );
              if (updatedAtResult && updatedAtResult.length > 0) {
                updatedAt = updatedAtResult[0].updatedAt ?? null;
              }
            } catch {
              // updatedAt não existe
            }

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
              cnpj,
              phone,
              email,
              address,
              city,
              state,
              zipCode,
              isActive: Boolean(isActive),
              createdAt: company.createdAt,
              updatedAt,
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
              cnpj: null,
              phone: null,
              email: null,
              address: null,
              city: null,
              state: null,
              zipCode: null,
              isActive: true,
              createdAt: company.createdAt,
              updatedAt: null,
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
      // Busca empresa usando raw SQL apenas com campos básicos que sempre existem
      const companyResult = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        name: string;
        createdAt: Date;
      }>>(
        `SELECT id, name, "createdAt" 
         FROM "Company" 
         WHERE id = ? 
         LIMIT 1`,
        id
      );

      if (!companyResult || companyResult.length === 0) {
        throw new NotFoundException("Empresa não encontrada");
      }

      const company = companyResult[0];

      // Tenta buscar campos opcionais individualmente (podem não existir)
      let cnpj: string | null = null;
      let phone: string | null = null;
      let email: string | null = null;
      let address: string | null = null;
      let city: string | null = null;
      let state: string | null = null;
      let zipCode: string | null = null;
      let isActive: number = 1;
      let updatedAt: Date | null = null;

      try {
        const extended = await this.prisma.$queryRawUnsafe<Array<{
          cnpj: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zipCode: string | null;
          isActive: number;
          updatedAt: Date | null;
        }>>(
          `SELECT cnpj, phone, email, address, city, state, "zipCode", "isActive", "updatedAt" 
           FROM "Company" 
           WHERE id = ? 
           LIMIT 1`,
          id
        );
        if (extended && extended.length > 0) {
          cnpj = extended[0].cnpj;
          phone = extended[0].phone;
          email = extended[0].email;
          address = extended[0].address;
          city = extended[0].city;
          state = extended[0].state;
          zipCode = extended[0].zipCode;
          isActive = extended[0].isActive;
          updatedAt = extended[0].updatedAt;
        }
      } catch {
        // Campos opcionais não existem, mantém valores padrão
      }

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
        cnpj,
        phone,
        email,
        address,
        city,
        state,
        zipCode,
        isActive: Boolean(isActive),
        createdAt: company.createdAt,
        updatedAt,
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
      // Se falhar por causa de campos que não existem, tenta buscar apenas básicos usando raw SQL
      if (error.message?.includes("no column") || error.message?.includes("no such column")) {
        const companyResult = await this.prisma.$queryRawUnsafe<Array<{
          id: string;
          name: string;
          createdAt: Date;
        }>>(
          `SELECT id, name, "createdAt" FROM "Company" WHERE id = ? LIMIT 1`,
          id
        );

        if (!companyResult || companyResult.length === 0) {
          throw new NotFoundException("Empresa não encontrada");
        }

        const company = companyResult[0];
        const [usersCount, employeesCount, eventsCount] = await Promise.all([
          this.prisma.user.count({ where: { companyId: id } }).catch(() => 0),
          this.prisma.employeeProfile.count({ where: { companyId: id } }).catch(() => 0),
          this.prisma.timeClockEvent.count({ where: { companyId: id } }).catch(() => 0),
        ]);

        return {
          id: company.id,
          name: company.name,
          cnpj: null,
          phone: null,
          email: null,
          address: null,
          city: null,
          state: null,
          zipCode: null,
          isActive: true,
          createdAt: company.createdAt,
          updatedAt: null,
          _count: {
            users: usersCount,
            employees: employeesCount,
            events: eventsCount,
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
    // Só verifica se CNPJ foi fornecido E se a coluna existe no banco
    if (normalizedCnpj) {
      // Primeiro verifica se a coluna cnpj existe
      let cnpjColumnExists = false;
      try {
        await this.prisma.$queryRawUnsafe(`SELECT cnpj FROM "Company" LIMIT 1`);
        cnpjColumnExists = true;
      } catch {
        // Coluna não existe, não verifica duplicação
        cnpjColumnExists = false;
      }

      // Se a coluna existe, verifica duplicação
      if (cnpjColumnExists) {
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
          // Outros erros são ignorados (pode ser que a coluna tenha sido deletada entre as verificações)
        }
      }
    }

    // Cria empresa usando raw SQL - apenas campos básicos que sempre existem
    const companyId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {

      // Insere apenas com campos básicos que sempre existem (id, name, createdAt)
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "Company" (id, name, "createdAt") VALUES (?, ?, datetime('now'))`,
        companyId,
        dto.name
      );

      // Depois, tenta atualizar com campos opcionais um por um (se existirem)
      // Isso evita erro se algum campo não existir
      const updates: Array<{ field: string; value: any }> = [];

      if (normalizedCnpj !== null && normalizedCnpj !== undefined) {
        updates.push({ field: 'cnpj', value: normalizedCnpj });
      }
      if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim()) {
        updates.push({ field: 'phone', value: dto.phone.trim() });
      }
      if (dto.email !== undefined && dto.email !== null && dto.email.trim()) {
        updates.push({ field: 'email', value: dto.email.trim().toLowerCase() });
      }
      if (dto.address !== undefined && dto.address !== null && dto.address.trim()) {
        updates.push({ field: 'address', value: dto.address.trim() });
      }
      if (dto.city !== undefined && dto.city !== null && dto.city.trim()) {
        updates.push({ field: 'city', value: dto.city.trim() });
      }
      if (dto.state !== undefined && dto.state !== null && dto.state.trim()) {
        updates.push({ field: 'state', value: dto.state.trim() });
      }
      if (dto.zipCode !== undefined && dto.zipCode !== null && dto.zipCode.trim()) {
        updates.push({ field: '"zipCode"', value: dto.zipCode.trim() });
      }
      if (dto.isActive !== undefined) {
        updates.push({ field: '"isActive"', value: dto.isActive ? 1 : 0 });
      }

      // Tenta atualizar cada campo opcional individualmente
      for (const update of updates) {
        try {
          await this.prisma.$executeRawUnsafe(
            `UPDATE "Company" SET ${update.field} = ? WHERE id = ?`,
            update.value,
            companyId
          );
        } catch {
          // Campo não existe, ignora e continua com os próximos
        }
      }

      // Tenta atualizar updatedAt se existir
      try {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Company" SET "updatedAt" = datetime('now') WHERE id = ?`,
          companyId
        );
      } catch {
        // updatedAt não existe, ignora
      }
    } catch (error: any) {
      // Se falhar na inserção básica, tenta criar usando Prisma
      if (error.message?.includes("no column") || error.message?.includes("no such column")) {
        try {
          await this.prisma.company.create({
            data: {
              id: companyId,
              name: dto.name,
            },
          });
        } catch (fallbackError: any) {
          throw new BadRequestException(`Erro ao criar empresa: ${fallbackError.message || "Erro desconhecido"}`);
        }
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
    // Verifica se empresa existe usando raw SQL apenas com campos básicos
    const companyResult = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      name: string;
    }>>(
      `SELECT id, name FROM "Company" WHERE id = ? LIMIT 1`,
      id
    );

    if (!companyResult || companyResult.length === 0) {
      throw new NotFoundException("Empresa não encontrada");
    }

    const company = companyResult[0];
    
    // Tenta buscar cnpj atual se a coluna existir
    let currentCnpj: string | null = null;
    try {
      const cnpjResult = await this.prisma.$queryRawUnsafe<Array<{ cnpj: string | null }>>(
        `SELECT cnpj FROM "Company" WHERE id = ? LIMIT 1`,
        id
      );
      if (cnpjResult && cnpjResult.length > 0) {
        currentCnpj = cnpjResult[0].cnpj;
      }
    } catch {
      // Coluna cnpj não existe, mantém null
      currentCnpj = null;
    }

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

    // Verificar se CNPJ já existe em outra empresa (usando raw SQL) - apenas se cnpj foi fornecido e coluna existe
    // Só faz a verificação se currentCnpj não for null (ou seja, a coluna existe) OU se currentCnpj for null mas normalizadoCnpj foi fornecido
    if (normalizedCnpj !== null && normalizedCnpj !== currentCnpj && currentCnpj !== undefined) {
      // Se chegou aqui e currentCnpj não é undefined, significa que a coluna existe (mesmo que seja null)
      // Então podemos verificar duplicação
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
        // Se a coluna cnpj não existir, ignora a verificação (não deveria chegar aqui, mas por segurança)
        if (error.message?.includes("no column") || error.message?.includes("no such column") || error.message?.includes("cnpj")) {
          // Continua sem verificar CNPJ
        } else {
          throw error;
        }
      }
    }
    // Se currentCnpj for undefined (coluna não existe), não verifica duplicação

    // Atualiza campos básicos primeiro (sempre existem)
    if (dto.name !== undefined) {
      try {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Company" SET "name" = ? WHERE "id" = ?`,
          dto.name.trim(),
          id
        );
      } catch (error: any) {
        // Se falhar, tenta com Prisma
        try {
          await this.prisma.company.update({
            where: { id },
            data: { name: dto.name.trim() },
          });
        } catch {
          throw new BadRequestException(`Erro ao atualizar nome da empresa: ${error.message || "Erro desconhecido"}`);
        }
      }
    }

    // Atualiza campos opcionais um por um (evita erro se algum não existir)
    const optionalUpdates: Array<{ field: string; value: any }> = [];

    if (dto.cnpj !== undefined) {
      optionalUpdates.push({ field: 'cnpj', value: normalizedCnpj });
    }
    if (dto.phone !== undefined) {
      optionalUpdates.push({ field: 'phone', value: dto.phone?.trim() || null });
    }
    if (dto.email !== undefined) {
      optionalUpdates.push({ field: 'email', value: dto.email?.trim().toLowerCase() || null });
    }
    if (dto.address !== undefined) {
      optionalUpdates.push({ field: 'address', value: dto.address?.trim() || null });
    }
    if (dto.city !== undefined) {
      optionalUpdates.push({ field: 'city', value: dto.city?.trim() || null });
    }
    if (dto.state !== undefined) {
      optionalUpdates.push({ field: 'state', value: dto.state?.trim() || null });
    }
    if (dto.zipCode !== undefined) {
      optionalUpdates.push({ field: '"zipCode"', value: dto.zipCode?.trim() || null });
    }
    if (dto.isActive !== undefined) {
      optionalUpdates.push({ field: '"isActive"', value: dto.isActive ? 1 : 0 });
    }

    // Tenta atualizar cada campo opcional individualmente
    for (const update of optionalUpdates) {
      try {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Company" SET ${update.field} = ? WHERE "id" = ?`,
          update.value,
          id
        );
      } catch {
        // Campo não existe, ignora e continua com os próximos
      }
    }

    // Tenta atualizar updatedAt se existir
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Company" SET "updatedAt" = datetime('now') WHERE "id" = ?`,
        id
      );
    } catch {
      // updatedAt não existe, ignora
    }

    // Retorna empresa atualizada
    return await this.getCompanyById(id);
  }

  async deleteCompany(id: string) {
    // Busca empresa usando raw SQL para evitar erro de cnpj
    const companyResult = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      name: string;
      createdAt: Date;
    }>>(
      `SELECT id, name, "createdAt" FROM "Company" WHERE id = ? LIMIT 1`,
      id
    );

    if (!companyResult || companyResult.length === 0) {
      throw new NotFoundException("Empresa não encontrada");
    }

    const company = companyResult[0];

    // Verificar se há dados associados
    const [usersCount, employeesCount, eventsCount] = await Promise.all([
      this.prisma.user.count({ where: { companyId: id } }),
      this.prisma.employeeProfile.count({ where: { companyId: id } }),
      this.prisma.timeClockEvent.count({ where: { companyId: id } }),
    ]);

    if (usersCount > 0 || employeesCount > 0 || eventsCount > 0) {
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
    // Verifica se empresa existe usando raw SQL para evitar erro de cnpj
    const companyResult = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Company" WHERE id = ? LIMIT 1`,
      companyId
    );

    if (!companyResult || companyResult.length === 0) {
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
    // Verifica se empresa existe usando raw SQL para evitar erro de cnpj
    const companyResult = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      name: string;
      createdAt: Date;
    }>>(
      `SELECT id, name, "createdAt" FROM "Company" WHERE id = ? LIMIT 1`,
      companyId
    );

    if (!companyResult || companyResult.length === 0) {
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
    // Busca empresa usando raw SQL para evitar erro de cnpj
    const companyResult = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      name: string;
      createdAt: Date;
    }>>(
      `SELECT id, name, "createdAt" FROM "Company" WHERE id = ? LIMIT 1`,
      companyId
    );

    if (!companyResult || companyResult.length === 0) {
      throw new NotFoundException("Empresa não encontrada");
    }

    const company = companyResult[0];

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

