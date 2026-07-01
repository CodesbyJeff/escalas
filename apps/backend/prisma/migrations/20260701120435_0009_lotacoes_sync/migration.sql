-- Lotacao: dropar unique de sigla (colide no SISBOM)
DROP INDEX "Lotacao_sigla_key";

-- Lotacao: novas colunas de sync
ALTER TABLE "Lotacao" ADD COLUMN "sisbom_id" TEXT;
ALTER TABLE "Lotacao" ADD COLUMN "sisbom_ref" TEXT;
ALTER TABLE "Lotacao" ADD COLUMN "sigla_extenso" TEXT;
ALTER TABLE "Lotacao" ADD COLUMN "last_sync_at" TIMESTAMP(3);

-- Lotacao.id: passa a autoincrement (sequence)
CREATE SEQUENCE "Lotacao_id_seq";
ALTER TABLE "Lotacao" ALTER COLUMN "id" SET DEFAULT nextval('"Lotacao_id_seq"');
ALTER SEQUENCE "Lotacao_id_seq" OWNED BY "Lotacao"."id";
SELECT setval('"Lotacao_id_seq"', coalesce((SELECT max("id") FROM "Lotacao"), 0) + 1, false);

-- Índices unique dos novos campos naturais
CREATE UNIQUE INDEX "Lotacao_sisbom_id_key" ON "Lotacao"("sisbom_id");
CREATE UNIQUE INDEX "Lotacao_sisbom_ref_key" ON "Lotacao"("sisbom_ref");

-- User: ref cru da última lotação SISBOM (reconciliação de troca)
ALTER TABLE "User" ADD COLUMN "sisbom_lotacao_ref" TEXT;
