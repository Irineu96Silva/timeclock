-- Ensure User.companyId is nullable and can be NULL for SUPER_ADMIN
-- This migration ensures compatibility with Turso database
-- SQLite allows NULL values by default, so we just ensure the constraint is correct

-- For SQLite, we need to recreate the table to change constraints if needed
-- However, since companyId is already TEXT (nullable), this is mostly a safeguard

-- Verify the unique constraint handles NULL values correctly
-- In SQLite, multiple NULL values are allowed in unique indexes
-- This allows multiple users with companyId = NULL (for SUPER_ADMIN)

-- No changes needed at SQL level, as the schema is already correct
-- The issue was in the seed.ts logic
