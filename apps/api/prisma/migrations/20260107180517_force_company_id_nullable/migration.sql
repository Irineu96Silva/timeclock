-- Force User.companyId to be nullable by recreating the table
-- This ensures that SUPER_ADMIN users can have companyId = NULL

-- Step 1: Create new table with nullable companyId
CREATE TABLE "User_new" (
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

-- Step 2: Copy all data from old table
INSERT INTO "User_new" ("id", "companyId", "email", "passwordHash", "role", "isActive", "refreshTokenHash", "createdAt", "updatedAt")
SELECT "id", "companyId", "email", "passwordHash", "role", "isActive", "refreshTokenHash", "createdAt", "updatedAt"
FROM "User";

-- Step 3: Drop old table
DROP TABLE "User";

-- Step 4: Rename new table
ALTER TABLE "User_new" RENAME TO "User";

-- Step 5: Recreate indexes
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_email_idx" ON "User"("email");

-- Step 6: Recreate unique constraint
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
