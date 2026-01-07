/*
  Warnings:

  - Added the required column `updatedAt` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "cpf" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "position" TEXT,
    "department" TEXT,
    "hireDate" DATETIME,
    "salary" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Company" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "createdAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");
CREATE INDEX "Company_cnpj_idx" ON "Company"("cnpj");
CREATE TABLE "new_CompanySettings" (
    "companyId" TEXT NOT NULL PRIMARY KEY,
    "geofenceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "geoRequired" BOOLEAN NOT NULL DEFAULT true,
    "geofenceLat" REAL NOT NULL,
    "geofenceLng" REAL NOT NULL,
    "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 200,
    "maxAccuracyMeters" INTEGER NOT NULL DEFAULT 100,
    "qrEnabled" BOOLEAN NOT NULL DEFAULT true,
    "punchFallbackMode" TEXT NOT NULL DEFAULT 'GEO_OR_QR',
    "qrSecret" TEXT NOT NULL DEFAULT '',
    "kioskDeviceLabel" TEXT NOT NULL DEFAULT '',
    "defaultWorkStartTime" TEXT DEFAULT '08:00',
    "defaultBreakStartTime" TEXT DEFAULT '12:00',
    "defaultBreakEndTime" TEXT DEFAULT '13:00',
    "defaultWorkEndTime" TEXT DEFAULT '17:00',
    "defaultToleranceMinutes" INTEGER DEFAULT 5,
    "defaultTimezone" TEXT DEFAULT 'America/Sao_Paulo',
    CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CompanySettings" ("companyId", "geoRequired", "geofenceEnabled", "geofenceLat", "geofenceLng", "geofenceRadiusMeters", "maxAccuracyMeters", "punchFallbackMode", "qrEnabled", "qrSecret", "defaultWorkStartTime", "defaultBreakStartTime", "defaultBreakEndTime", "defaultWorkEndTime", "defaultToleranceMinutes", "defaultTimezone") SELECT "companyId", "geoRequired", "geofenceEnabled", "geofenceLat", "geofenceLng", "geofenceRadiusMeters", "maxAccuracyMeters", "punchFallbackMode", "qrEnabled", "qrSecret", '08:00', '12:00', '13:00', '17:00', 5, 'America/Sao_Paulo' FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "refreshTokenHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("companyId", "createdAt", "email", "id", "isActive", "passwordHash", "refreshTokenHash", "role", "updatedAt") SELECT "companyId", "createdAt", "email", "id", "isActive", "passwordHash", "refreshTokenHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeProfileId_key" ON "Employee"("employeeProfileId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "Employee_cpf_idx" ON "Employee"("cpf");
