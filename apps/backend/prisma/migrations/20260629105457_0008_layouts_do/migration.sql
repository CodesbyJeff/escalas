-- DropIndex
DROP INDEX "TemplateLotacao_lotacao_id_key";

-- AlterTable: add nome as nullable first to allow backfill
ALTER TABLE "TemplateLotacao" ADD COLUMN "nome" TEXT;

-- Backfill: set existing rows to 'Padrão'
UPDATE "TemplateLotacao" SET "nome" = 'Padrão' WHERE "nome" IS NULL;

-- Set NOT NULL constraint after backfill
ALTER TABLE "TemplateLotacao" ALTER COLUMN "nome" SET NOT NULL;

-- AlterTable
ALTER TABLE "Escala" ADD COLUMN     "template_id" INTEGER;

-- CreateIndex
CREATE INDEX "Escala_template_id_idx" ON "Escala"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateLotacao_lotacao_id_nome_key" ON "TemplateLotacao"("lotacao_id", "nome");

-- AddForeignKey
ALTER TABLE "Escala" ADD CONSTRAINT "Escala_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "TemplateLotacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
