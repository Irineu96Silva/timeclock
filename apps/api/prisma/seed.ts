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
  
  // Buscar todos os usuários com esse email e role SUPER_ADMIN
  const usersWithEmail = await prisma.user.findMany({
    where: {
      email: superAdminEmail,
      role: "SUPER_ADMIN",
    },
  });

  let superAdmin;
  
  // Se encontrou algum usuário
  if (usersWithEmail.length > 0) {
    // Pega o primeiro (deve haver apenas um SUPER_ADMIN com esse email)
    const existing = usersWithEmail[0];
    // Atualiza para garantir que está correto
    superAdmin = await prisma.user.update({
      where: { id: existing.id },
      data: {
        companyId: null, // Garante que é null
        passwordHash: superAdminPasswordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
  } else {
    // Não existe, cria novo usando SQL raw com sintaxe que força NULL
    // Usa Prisma.$executeRawUnsafe para ter mais controle
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    try {
      // Tenta inserir sem especificar companyId (deve ser NULL por padrão)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "User" (id, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userId,
        superAdminEmail,
        superAdminPasswordHash,
        "SUPER_ADMIN",
        true,
        now,
        now
      );
      
      // Busca o usuário criado
      superAdmin = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!superAdmin) {
        throw new Error("Falha ao criar SUPER_ADMIN via SQL raw");
      }
    } catch (error: any) {
      // Se ainda falhar, tenta com NULL explícito
      if (error.message?.includes("NOT NULL") || error.code === "SQLITE_CONSTRAINT") {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "User" (id, "companyId", email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
          userId,
          superAdminEmail,
          superAdminPasswordHash,
          "SUPER_ADMIN",
          true,
          now,
          now
        );
        
        superAdmin = await prisma.user.findUnique({
          where: { id: userId },
        });
        
        if (!superAdmin) {
          throw new Error("Falha ao criar SUPER_ADMIN mesmo com NULL explícito");
        }
      } else {
        throw error;
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
