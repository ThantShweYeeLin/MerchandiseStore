-- Backfill any product left without its own discount using the category
-- rate it was previously falling back to, so existing rows survive the
-- NOT NULL constraint below with their current effective discount intact.
UPDATE "Product" p
SET "discountRate" = c."discountRate"
FROM "Category" c
WHERE p."categoryId" = c.id AND p."discountRate" IS NULL;

-- Anything still null (orphaned category, etc.) falls back to the old
-- global default of 0.15 rather than failing the migration.
UPDATE "Product" SET "discountRate" = 0.15 WHERE "discountRate" IS NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "discountRate" SET NOT NULL;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "discountRate";
