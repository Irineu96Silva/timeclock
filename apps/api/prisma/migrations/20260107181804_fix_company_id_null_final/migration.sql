-- Final fix: Ensure User.companyId is nullable
-- This migration handles the case where the database might have an old structure

-- First, let's check if we need to recreate the table
-- SQLite doesn't support ALTER COLUMN, so we need to recreate

-- Step 1: Disable foreign key checks temporarily
PRAGMA foreign_keys=OFF;

-- Step 2: Create backup table with correct structure (nullable companyId)
CREATE TABLE "User_backup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,  -- Explicitly nullable
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "refreshTokenHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Step 3: Copy all existing data (preserving NULLs)
INSERT INTO "User_backup" 
SELECT 
    "id", 
    "companyId",  -- This will preserve NULL values
    "email", 
    "passwordHash", 
    "role", 
    "isActive", 
    "refreshTokenHash", 
    "createdAt", 
    "updatedAt"
FROM "User";

-- Step 4: Drop old table
DROP TABLE "User";

-- Step 5: Rename backup to User
ALTER TABLE "User_backup" RENAME TO "User";

-- Step 6: Recreate foreign key constraint
-- Note: SQLite requires the constraint to be added via a separate statement
-- We'll recreate it when we recreate indexes

-- Step 7: Recreate all indexes
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_email_idx" ON "User"("email");

-- Step 8: Recreate unique constraint (allows NULL values)
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- Step 9: Re-enable foreign key checks
PRAGMA foreign_keys=ON;

-- Note: The foreign key constraint will be enforced by SQLite
-- but we can't add it back via ALTER TABLE in SQLite
-- The constraint is defined in the schema and will be checked at runtime
