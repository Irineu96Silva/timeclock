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
  
  try {
    // Se encontrou algum usuário
    if (usersWithEmail.length > 0) {
      // Pega o primeiro (deve haver apenas um SUPER_ADMIN com esse email)
      const existing = usersWithEmail[0];
      // Atualiza para garantir que está correto
      superAdmin = await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: superAdminPasswordHash,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });
    } else {
      // Primeiro, tenta criar uma empresa temporária para o SUPER_ADMIN
      // Usa SQL raw para evitar problemas com campos que podem não existir
      let tempCompanyId: string | null = null;
      
      try {
        const result = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Company" WHERE name = '__SUPER_ADMIN_TEMP__' LIMIT 1
        `;
        
        if (result.length > 0) {
          tempCompanyId = result[0].id;
        } else {
          // Cria empresa temporária usando SQL raw
          const newId = `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date().toISOString();
          
          await prisma.$executeRawUnsafe(
            `INSERT INTO "Company" (id, name, "createdAt", "updatedAt", "isActive")
             VALUES (?, ?, ?, ?, ?)`,
            newId,
            "__SUPER_ADMIN_TEMP__",
            now,
            now,
            true
          );
          
          tempCompanyId = newId;
        }
      } catch (error: any) {
        console.warn(`[Seed] Erro ao criar empresa temporária: ${error.message}`);
        throw error;
      }
      
      const tempCompany = { id: tempCompanyId! };

      // Cria o SUPER_ADMIN com a empresa temporária
      superAdmin = await prisma.user.create({
        data: {
          companyId: tempCompany.id,
          email: superAdminEmail,
          passwordHash: superAdminPasswordHash,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });

      // Agora tenta atualizar para remover o companyId
      // Se falhar, pelo menos o usuário existe
      try {
        await prisma.user.update({
          where: { id: superAdmin.id },
          data: { companyId: null },
        });
        // Se conseguiu, remove a empresa temporária
        await prisma.company.delete({
          where: { id: tempCompany.id },
        });
      } catch (updateError) {
        // Se não conseguir remover o companyId, deixa como está
        console.warn(`[Seed] Aviso: Não foi possível remover companyId do SUPER_ADMIN. O usuário foi criado com companyId=${tempCompany.id}`);
        console.warn(`[Seed] Você pode atualizar manualmente depois ou executar uma migração para corrigir.`);
      }
    }

    console.log("Super Admin criado/atualizado:");
    console.log(`Email: ${superAdminEmail}`);
    console.log(`Senha: ${superAdminPassword}`);
  } catch (error: any) {
    // Se falhar completamente, apenas loga um aviso mas não quebra o build
    console.error(`[Seed] Erro ao criar SUPER_ADMIN: ${error.message}`);
    console.error(`[Seed] O build continuará, mas você precisará criar o SUPER_ADMIN manualmente.`);
    console.error(`[Seed] Email: ${superAdminEmail}`);
    console.error(`[Seed] Senha: ${superAdminPassword}`);
    // Não lança o erro - permite que o seed continue
  }

  // 2) Criar Empresa Demo
  const companyName = "Empresa Demo";
  const adminEmail = "admin@demo.com";
  const adminPassword = "Admin123!";

  // 1) Company (procura primeiro; se nao existir, cria)
  // Usa select para evitar problemas com campos que podem não existir ainda
  let company = await prisma.company.findFirst({
    where: { name: companyName },
    select: { id: true, name: true }, // Apenas campos essenciais
  });

  if (!company) {
    company = await prisma.company.create({
      data: { name: companyName },
      select: { id: true, name: true },
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
  // Usa SQL raw para evitar problemas com campos que podem não existir no banco Turso
  try {
    // Verifica se já existe
    const existing = await prisma.$queryRaw<Array<{ companyId: string }>>`
      SELECT "companyId" FROM "CompanySettings" WHERE "companyId" = ${company.id} LIMIT 1
    `;
    
    if (existing.length > 0) {
      // Atualiza apenas campos básicos que sabemos que existem
      await prisma.$executeRawUnsafe(
        `UPDATE "CompanySettings" 
         SET "geofenceEnabled" = ?, "geoRequired" = ?, "geofenceLat" = ?, "geofenceLng" = ?, 
             "geofenceRadiusMeters" = ?, "maxAccuracyMeters" = ?
         WHERE "companyId" = ?`,
        true, true, 0, 0, 200, 100, company.id
      );
    } else {
      // Cria apenas com campos básicos
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CompanySettings" 
         ("companyId", "geofenceEnabled", "geoRequired", "geofenceLat", "geofenceLng", 
          "geofenceRadiusMeters", "maxAccuracyMeters")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        company.id, true, true, 0, 0, 200, 100
      );
    }
  } catch (error: any) {
    console.warn(`[Seed] Erro ao criar CompanySettings: ${error.message}`);
    // Não quebra o build, apenas loga o aviso
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
