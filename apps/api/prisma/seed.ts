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

async function main() {
  // 1) Criar Super Admin
  const superAdminEmail = "superadmin@timeclock.com";
  const superAdminPassword = "SuperAdmin123!";
  
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);
  
  // Verificar se super admin já existe (busca por email e role, sem companyId)
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      email: superAdminEmail,
      role: "SUPER_ADMIN",
    },
  });

  let superAdmin;
  if (existingSuperAdmin) {
    // Se existe mas tem companyId, atualiza para null usando raw SQL
    if (existingSuperAdmin.companyId !== null) {
      try {
        // Tenta atualizar com Prisma primeiro
        superAdmin = await prisma.user.update({
          where: { id: existingSuperAdmin.id },
          data: {
            companyId: null,
            passwordHash: superAdminPasswordHash,
            role: "SUPER_ADMIN",
            isActive: true,
          },
        });
      } catch (error: any) {
        // Se falhar por constraint, usa raw SQL
        if (error.code === "SQLITE_CONSTRAINT" || error.message?.includes("NOT NULL")) {
          console.log("Erro ao atualizar com Prisma, usando raw SQL...");
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "companyId" = NULL, "passwordHash" = ?, "role" = ?, "isActive" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`,
            superAdminPasswordHash,
            "SUPER_ADMIN",
            true,
            existingSuperAdmin.id
          );
          // Busca novamente após atualizar
          superAdmin = await prisma.user.findUnique({
            where: { id: existingSuperAdmin.id },
          });
          if (!superAdmin) {
            throw new Error("Não foi possível atualizar o Super Admin");
          }
        } else {
          throw error;
        }
      }
    } else {
      // Se já existe e está correto, apenas atualiza a senha
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
    // Cria novo super admin sem companyId
    // Para Turso/Libsql, precisamos ser cuidadosos com NULL values
    try {
      superAdmin = await prisma.user.create({
        data: {
          email: superAdminEmail,
          passwordHash: superAdminPasswordHash,
          role: "SUPER_ADMIN",
          isActive: true,
        } as any, // type-cast para evitar erro de tipo
      });
    } catch (error: any) {
      // Se falhar por constraint, tenta buscar novamente e atualizar
      console.log("Erro ao criar SUPER_ADMIN, tentando buscar e atualizar...", error.message);
      const retrySuperAdmin = await prisma.user.findFirst({
        where: {
          email: superAdminEmail,
          role: "SUPER_ADMIN",
        },
      });
      
      if (retrySuperAdmin) {
        try {
          superAdmin = await prisma.user.update({
            where: { id: retrySuperAdmin.id },
            data: {
              companyId: null,
              passwordHash: superAdminPasswordHash,
              role: "SUPER_ADMIN",
              isActive: true,
            },
          });
        } catch (updateError: any) {
          // Se falhar por constraint, usa raw SQL
          if (updateError.code === "SQLITE_CONSTRAINT" || updateError.message?.includes("NOT NULL")) {
            console.log("Erro ao atualizar com Prisma, usando raw SQL...");
            await prisma.$executeRawUnsafe(
              `UPDATE "User" SET "companyId" = NULL, "passwordHash" = ?, "role" = ?, "isActive" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`,
              superAdminPasswordHash,
              "SUPER_ADMIN",
              true,
              retrySuperAdmin.id
            );
            // Busca novamente após atualizar
            superAdmin = await prisma.user.findUnique({
              where: { id: retrySuperAdmin.id },
            });
            if (!superAdmin) {
              throw new Error("Não foi possível atualizar o Super Admin");
            }
          } else {
            throw updateError;
          }
        }
      } else {
        // Última tentativa: usar raw SQL
        console.log("Tentando criar SUPER_ADMIN com raw SQL...");
        const superAdminId = `superadmin_${Date.now()}`;
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "User" (id, email, "passwordHash", role, "isActive", "createdAt", "updatedAt", "companyId")
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)`,
            superAdminId,
            superAdminEmail,
            superAdminPasswordHash,
            "SUPER_ADMIN",
            true
          );
        } catch (sqlError: any) {
          // Se falhar por constraint, tenta buscar novamente
          console.log("Erro ao inserir com SQL, tentando buscar...", sqlError.message);
        }
        superAdmin = await prisma.user.findFirst({
          where: {
            email: superAdminEmail,
            role: "SUPER_ADMIN",
          },
        });
        if (!superAdmin) {
          throw new Error("Não foi possível criar o Super Admin");
        }
      }
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
  let company = await prisma.company.findFirst({
    where: { name: companyName },
  });

  if (!company) {
    company = await prisma.company.create({
      data: { name: companyName },
    });
  }

  // 2) User admin (usa unique composto companyId + email)
  const existingAdmin = await prisma.user.findFirst({
    where: {
      companyId: company.id,
      email: adminEmail,
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  const adminUser = existingAdmin
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

  // 4) EmployeeProfile para o admin (userId e unique)
  await prisma.employeeProfile.upsert({
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

  // 5) CompanySettings padrao
  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    update: {
      geofenceEnabled: true,
      geoRequired: true,
      geofenceLat: 0,
      geofenceLng: 0,
      geofenceRadiusMeters: 200,
      maxAccuracyMeters: 100,
    },
    create: {
      companyId: company.id,
      geofenceEnabled: true,
      geoRequired: true,
      geofenceLat: 0,
      geofenceLng: 0,
      geofenceRadiusMeters: 200,
      maxAccuracyMeters: 100,
    },
  });

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
