-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN "workStartTime" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN "breakStartTime" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN "breakEndTime" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN "workEndTime" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN "toleranceMinutes" INTEGER DEFAULT 5;
ALTER TABLE "EmployeeProfile" ADD COLUMN "timezone" TEXT DEFAULT 'America/Sao_Paulo';
