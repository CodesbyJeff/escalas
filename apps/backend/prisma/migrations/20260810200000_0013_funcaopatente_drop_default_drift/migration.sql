-- Drift fix: migration 0011 created "FuncaoPatente"."patente_ids" with
-- DEFAULT ARRAY[]::INTEGER[], but schema.prisma never declared that default
-- (Int[] with no @default). This migration reconciles the DB with the schema.
-- Metadata-only change: no data is affected, no call site relies on the column default.
-- AlterTable
ALTER TABLE "FuncaoPatente" ALTER COLUMN "patente_ids" DROP DEFAULT;
