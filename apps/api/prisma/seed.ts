import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
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

  // 2) Hash da senha
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // 3) User admin (usa unique composto companyId + email)
  const adminUser = await prisma.user.upsert({
    where: {
      companyId_email: { companyId: company.id, email: adminEmail },
    },
    update: {
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
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

  console.log("Seed concluido:");
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
