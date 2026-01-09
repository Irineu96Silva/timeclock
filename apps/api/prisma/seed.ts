import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import bcrypt from "bcrypt";

// Configura o Prisma com adaptador Turso se as variáveis estiverem disponíveis
function buildPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoAuthToken) {
    console.log("[Seed] Usando adaptador Turso (libsql)");
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
    const adapter = new PrismaLibSQL(libsql as any);
    return new PrismaClient({ adapter: adapter as any });
  }

  console.log("[Seed] Usando SQLite (fallback)");
  return new PrismaClient();
}

const prisma = buildPrismaClient();

// Função helper para retry com backoff exponencial
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Se for erro de servidor (502, 503, 504) ou timeout, tenta novamente
      if (
        error.code === "SERVER_ERROR" ||
        error.message?.includes("502") ||
        error.message?.includes("503") ||
        error.message?.includes("504") ||
        error.message?.includes("timeout")
      ) {
        if (attempt < maxRetries - 1) {
          const waitTime = delayMs * Math.pow(2, attempt);
          console.log(`Erro de conexão (tentativa ${attempt + 1}/${maxRetries}), aguardando ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }
      // Se não for erro de rede, propaga imediatamente
      throw error;
    }
  }
  throw lastError;
}

async function main() {
  // 1) Criar Super Admin
  const superAdminEmail = "superadmin@timeclock.com";
  const superAdminPassword = "SuperAdmin123!";
  
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);
  
  // Verificar se super admin já existe (busca por email e role, sem companyId)
  // Usa retry para lidar com erros temporários de conexão (502, 503, etc)
  let existingSuperAdmin;
  try {
    existingSuperAdmin = await withRetry(async () => {
      return await prisma.user.findFirst({
        where: {
          email: superAdminEmail,
          role: "SUPER_ADMIN",
        },
      });
    }, 5, 2000); // 5 tentativas, começando com 2 segundos
  } catch (error: any) {
    console.error("Erro ao buscar Super Admin existente:", error.message);
    // Se falhar completamente, assume que não existe e tenta criar
    existingSuperAdmin = null;
  }

  let superAdmin;
  if (existingSuperAdmin) {
    // Se existe, apenas atualiza a senha e outros campos (sem tocar no companyId)
    // O banco Turso pode ter constraint NOT NULL, então não tentamos atualizar companyId para NULL
    console.log("Atualizando senha do Super Admin existente...");
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "passwordHash" = ?, "role" = ?, "isActive" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`,
        superAdminPasswordHash,
        "SUPER_ADMIN",
        true,
        existingSuperAdmin.id
      );
      superAdmin = await prisma.user.findUnique({
        where: { id: existingSuperAdmin.id },
      });
      if (!superAdmin) {
        throw new Error("Não foi possível atualizar o Super Admin");
      }
    } catch (error: any) {
      // Se falhar, tenta com Prisma (sem tocar no companyId)
      console.log("Erro ao atualizar com raw SQL, tentando com Prisma...", error.message);
      superAdmin = await prisma.user.update({
        where: { id: existingSuperAdmin.id },
        data: {
          passwordHash: superAdminPasswordHash,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });
    }
  } else {
    // Cria novo super admin
    // Primeiro tenta com NULL, se falhar cria uma empresa SYSTEM e usa ela
    console.log("Criando novo Super Admin...");
    const superAdminId = `superadmin_${Date.now()}`;
    
    try {
      // Tenta inserir com companyId = NULL
      await prisma.$executeRawUnsafe(
        `INSERT INTO "User" (id, email, "passwordHash", role, "isActive", "createdAt", "updatedAt", "companyId")
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)`,
        superAdminId,
        superAdminEmail,
        superAdminPasswordHash,
        "SUPER_ADMIN",
        true
      );
      // Busca o registro criado
      superAdmin = await prisma.user.findUnique({
        where: { id: superAdminId },
      });
    } catch (sqlError: any) {
      // Se falhar por constraint NOT NULL, cria empresa SYSTEM e usa ela
      if (sqlError.code === "SQLITE_CONSTRAINT" && sqlError.message?.includes("NOT NULL")) {
        console.log("Banco não aceita NULL em companyId, criando empresa SYSTEM...");
        
        // Busca ou cria empresa SYSTEM usando select explícito
        let systemCompany = await prisma.company.findFirst({
          where: { name: "SYSTEM" },
          select: { id: true, name: true, createdAt: true },
        });
        
        if (!systemCompany) {
          // Cria usando raw SQL para evitar campos que não existem
          const systemCompanyId = `system_${Date.now()}`;
          await prisma.$executeRawUnsafe(
            `INSERT INTO "Company" (id, name, "createdAt") VALUES (?, ?, datetime('now'))`,
            systemCompanyId,
            "SYSTEM"
          );
          systemCompany = await prisma.company.findUnique({
            where: { id: systemCompanyId },
            select: { id: true, name: true, createdAt: true },
          });
          if (!systemCompany) {
            throw new Error("Não foi possível criar empresa SYSTEM");
          }
        }
        
        // Cria Super Admin com empresa SYSTEM
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "User" (id, email, "passwordHash", role, "isActive", "createdAt", "updatedAt", "companyId")
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
            superAdminId,
            superAdminEmail,
            superAdminPasswordHash,
            "SUPER_ADMIN",
            true,
            systemCompany.id
          );
          superAdmin = await prisma.user.findUnique({
            where: { id: superAdminId },
          });
        } catch (createError: any) {
          // Se ainda falhar, tenta buscar existente
          console.log("Erro ao criar com empresa SYSTEM, tentando buscar existente...", createError.message);
          const retrySuperAdmin = await prisma.user.findFirst({
            where: {
              email: superAdminEmail,
              role: "SUPER_ADMIN",
            },
          });
          
          if (retrySuperAdmin) {
            // Se encontrou, apenas atualiza senha
            console.log("Super Admin já existe, atualizando senha...");
            try {
              await prisma.$executeRawUnsafe(
                `UPDATE "User" SET "passwordHash" = ?, "role" = ?, "isActive" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`,
                superAdminPasswordHash,
                "SUPER_ADMIN",
                true,
                retrySuperAdmin.id
              );
              superAdmin = await prisma.user.findUnique({
                where: { id: retrySuperAdmin.id },
              });
            } catch (updateError: any) {
              // Se falhar, tenta com Prisma
              console.log("Erro ao atualizar com raw SQL, tentando com Prisma...", updateError.message);
              superAdmin = await prisma.user.update({
                where: { id: retrySuperAdmin.id },
                data: {
                  passwordHash: superAdminPasswordHash,
                  role: "SUPER_ADMIN",
                  isActive: true,
                },
              });
            }
          } else {
            throw new Error(`Não foi possível criar o Super Admin: ${createError.message}`);
          }
        }
      } else {
        // Outro tipo de erro (ex: email já existe), tenta buscar
        console.log("Erro ao inserir com SQL, tentando buscar existente...", sqlError.message);
        const retrySuperAdmin = await prisma.user.findFirst({
          where: {
            email: superAdminEmail,
            role: "SUPER_ADMIN",
          },
        });
        
        if (retrySuperAdmin) {
          // Se encontrou, apenas atualiza senha
          console.log("Super Admin já existe, atualizando senha...");
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE "User" SET "passwordHash" = ?, "role" = ?, "isActive" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`,
              superAdminPasswordHash,
              "SUPER_ADMIN",
              true,
              retrySuperAdmin.id
            );
            superAdmin = await prisma.user.findUnique({
              where: { id: retrySuperAdmin.id },
            });
          } catch (updateError: any) {
            // Se falhar, tenta com Prisma
            console.log("Erro ao atualizar com raw SQL, tentando com Prisma...", updateError.message);
            superAdmin = await prisma.user.update({
              where: { id: retrySuperAdmin.id },
              data: {
                passwordHash: superAdminPasswordHash,
                role: "SUPER_ADMIN",
                isActive: true,
              },
            });
          }
        } else {
          throw new Error(`Não foi possível criar o Super Admin: ${sqlError.message}`);
        }
      }
    }
    
    if (!superAdmin) {
      throw new Error("Não foi possível criar ou encontrar o Super Admin");
    }
  }

  console.log("Super Admin criado/atualizado:");
  console.log(`Email: ${superAdminEmail}`);
  console.log(`Senha: ${superAdminPassword}`);

  // 2) Criar Empresa Demo
  const companyName = "Empresa Demo";
  const adminEmail = "admin@demo.com";
  const adminPassword = "Admin123!";

  // 1) Company (procura primeiro; se nao existir, cria)
  // Usa select explícito para evitar campos que não existem no banco
  // Usa retry para lidar com erros temporários de conexão
  let company = await withRetry(async () => {
    return await prisma.company.findFirst({
      where: { name: companyName },
      select: { id: true, name: true, createdAt: true },
    });
  }, 5, 2000);

  if (!company) {
    // Cria usando raw SQL para evitar campos que não existem
    const companyId = `company_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Company" (id, name, "createdAt") VALUES (?, ?, datetime('now'))`,
      companyId,
      companyName
    );
    company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, createdAt: true },
    });
    if (!company) {
      throw new Error("Não foi possível criar empresa Demo");
    }
  }

  // 2) User admin (usa unique composto companyId + email)
  // Usa retry para lidar com erros temporários de conexão
  const existingAdmin = await withRetry(async () => {
    return await prisma.user.findFirst({
      where: {
        companyId: company.id,
        email: adminEmail,
      },
    });
  }, 5, 2000);

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  // Usa retry para criar/atualizar admin user
  const adminUser = await withRetry(async () => {
    return existingAdmin
      ? await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            passwordHash,
            role: "ADMIN",
            isActive: true,
          },
        })
      : await prisma.user.create({
          data: {
            companyId: company.id,
            email: adminEmail,
            passwordHash,
            role: "ADMIN",
            isActive: true,
          },
        });
  }, 5, 2000);

  // 4) EmployeeProfile para o admin (userId e unique)
  // Usa retry para criar/atualizar employee profile
  await withRetry(async () => {
    return await prisma.employeeProfile.upsert({
      where: { userId: adminUser.id },
      update: {
        fullName: "Admin Demo",
        isActive: true,
      },
      create: {
        companyId: company.id,
        userId: adminUser.id,
        fullName: "Admin Demo",
        isActive: true,
      },
    });
  }, 5, 2000);

  // 5) CompanySettings padrao
  // Usa raw SQL para evitar campos que não existem no banco
  try {
    // Verifica se já existe (com retry)
    const existingSettings = await withRetry(async () => {
      return await prisma.$queryRawUnsafe(
        `SELECT "companyId" FROM "CompanySettings" WHERE "companyId" = ? LIMIT 1`,
        company.id
      ) as Array<{ companyId: string }>;
    }, 5, 2000);
    
    if (existingSettings.length > 0) {
      // Atualiza apenas campos básicos (com retry)
      await withRetry(async () => {
        return await prisma.$executeRawUnsafe(
          `UPDATE "CompanySettings" 
           SET "geofenceEnabled" = ?, "geoRequired" = ?, "geofenceLat" = ?, "geofenceLng" = ?, 
               "geofenceRadiusMeters" = ?, "maxAccuracyMeters" = ?, "qrEnabled" = ?, 
               "punchFallbackMode" = ?, "qrSecret" = ?, "kioskDeviceLabel" = ?
           WHERE "companyId" = ?`,
          true,  // geofenceEnabled
          true,  // geoRequired
          0,     // geofenceLat
          0,     // geofenceLng
          200,   // geofenceRadiusMeters
          100,   // maxAccuracyMeters
          true,  // qrEnabled
          "GEO_OR_QR",  // punchFallbackMode
          "",    // qrSecret
          "",    // kioskDeviceLabel
          company.id
        );
      }, 5, 2000);
    } else {
      // Cria apenas com campos básicos (com retry)
      await withRetry(async () => {
        return await prisma.$executeRawUnsafe(
          `INSERT INTO "CompanySettings" 
           ("companyId", "geofenceEnabled", "geoRequired", "geofenceLat", "geofenceLng", 
            "geofenceRadiusMeters", "maxAccuracyMeters", "qrEnabled", "punchFallbackMode", 
            "qrSecret", "kioskDeviceLabel")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          company.id,
          true,  // geofenceEnabled
          true,  // geoRequired
          0,     // geofenceLat
          0,     // geofenceLng
          200,   // geofenceRadiusMeters
          100,   // maxAccuracyMeters
          true,  // qrEnabled
          "GEO_OR_QR",  // punchFallbackMode
          "",    // qrSecret
          ""     // kioskDeviceLabel
        );
      }, 5, 2000);
    }
  } catch (error: any) {
    // Se falhar, apenas loga o erro mas não interrompe o seed
    console.log("Aviso: Não foi possível criar/atualizar CompanySettings:", error.message);
  }

  console.log("\nSeed concluído:");
  console.log(`Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`Company: ${company.name} (${company.id})`);
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
