import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import bcrypt from "bcrypt";

// Configura o Prisma com adaptador Turso se as variáveis estiverem disponíveis
function buildPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoAuthToken) {
    console.log("[Reset] Usando adaptador Turso (libsql)");
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
    const adapter = new PrismaLibSQL(libsql as any);
    return new PrismaClient({ adapter: adapter as any });
  }

  console.log("[Reset] Usando SQLite (fallback)");
  return new PrismaClient();
}

const prisma = buildPrismaClient();

async function main() {
  const superAdminEmail = process.argv[2] || "superadmin@timeclock.com";
  const newPassword = process.argv[3] || "SuperAdmin123!";

  console.log(`\n🔐 Resetando senha do Super Admin...`);
  console.log(`📧 Email: ${superAdminEmail}`);
  console.log(`🔑 Nova senha: ${newPassword}\n`);

  // Busca o Super Admin
  const superAdmin = await prisma.user.findFirst({
    where: {
      email: superAdminEmail,
      role: "SUPER_ADMIN",
    },
  });

  if (!superAdmin) {
    console.error(`❌ Super Admin não encontrado com email: ${superAdminEmail}`);
    console.log(`\n📝 Tentando criar novo Super Admin...\n`);

    // Tenta criar o Super Admin
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    try {
      // Tenta criar sem companyId primeiro
      const newSuperAdmin = await prisma.user.create({
        data: {
          email: superAdminEmail,
          passwordHash,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });

      console.log(`✅ Super Admin criado com sucesso!`);
      console.log(`   ID: ${newSuperAdmin.id}`);
      console.log(`   Email: ${newSuperAdmin.email}`);
      console.log(`   Role: ${newSuperAdmin.role}`);
      console.log(`   CompanyId: ${newSuperAdmin.companyId || "null"}`);
    } catch (error: any) {
      if (error.message?.includes("NOT NULL") || error.code === "SQLITE_CONSTRAINT") {
        // Se falhar, cria com empresa temporária
        console.log(`⚠️  Tentando criar com empresa temporária...`);
        
        const tempCompanyId = `temp_${Date.now()}`;
        const now = new Date().toISOString();
        
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "Company" (id, name, "createdAt", "isActive")
             VALUES (?, ?, ?, ?)`,
            tempCompanyId,
            "__SUPER_ADMIN_TEMP__",
            now,
            true
          );
        } catch (e: any) {
          // Empresa pode já existir
          if (!e.message?.includes("UNIQUE")) {
            throw e;
          }
        }

        const newSuperAdmin = await prisma.user.create({
          data: {
            companyId: tempCompanyId,
            email: superAdminEmail,
            passwordHash,
            role: "SUPER_ADMIN",
            isActive: true,
          },
        });

        console.log(`✅ Super Admin criado com sucesso (com empresa temporária)!`);
        console.log(`   ID: ${newSuperAdmin.id}`);
        console.log(`   Email: ${newSuperAdmin.email}`);
        console.log(`   Role: ${newSuperAdmin.role}`);
        console.log(`   CompanyId: ${newSuperAdmin.companyId}`);
        console.log(`\n⚠️  Nota: O Super Admin foi criado com uma empresa temporária.`);
        console.log(`   Você pode atualizar o companyId para null depois se necessário.`);
      } else {
        throw error;
      }
    }
  } else {
    // Atualiza a senha
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: {
        passwordHash,
        isActive: true,
      },
    });

    console.log(`✅ Senha do Super Admin resetada com sucesso!`);
    console.log(`   ID: ${superAdmin.id}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   CompanyId: ${superAdmin.companyId || "null"}`);
  }

  console.log(`\n🎉 Processo concluído!`);
  console.log(`\n📋 Credenciais de acesso:`);
  console.log(`   Email: ${superAdminEmail}`);
  console.log(`   Senha: ${newPassword}`);
  console.log(`\n💡 Use essas credenciais para fazer login no sistema.\n`);
}

main()
  .catch((e) => {
    console.error("\n❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

