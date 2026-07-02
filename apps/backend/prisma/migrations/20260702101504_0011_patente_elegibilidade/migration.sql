-- Réplica local estática das patentes do SISBOM (id = _patente).
CREATE TABLE "Patente" (
  "id"       INTEGER NOT NULL,
  "forca_id" INTEGER NOT NULL,
  "sigla"    TEXT    NOT NULL,
  "nome"     TEXT    NOT NULL,
  "ordem"    INTEGER NOT NULL,
  CONSTRAINT "Patente_pkey" PRIMARY KEY ("id")
);

-- Patente do militar (vinda do sync SISBOM).
ALTER TABLE "User" ADD COLUMN "patente_id" INTEGER;
ALTER TABLE "User" ADD CONSTRAINT "User_patente_id_fkey"
  FOREIGN KEY ("patente_id") REFERENCES "Patente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cascata de elegibilidade (global/lotação/layout numa tabela só).
CREATE TABLE "FuncaoPatente" (
  "id"          SERIAL   NOT NULL,
  "lotacao_id"  INTEGER,
  "template_id" INTEGER,
  "funcao_norm" TEXT     NOT NULL,
  "patente_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  CONSTRAINT "FuncaoPatente_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "FuncaoPatente" ADD CONSTRAINT "FuncaoPatente_lotacao_id_fkey"
  FOREIGN KEY ("lotacao_id") REFERENCES "Lotacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuncaoPatente" ADD CONSTRAINT "FuncaoPatente_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "TemplateLotacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unicidade por escopo via índices únicos parciais (NULL não deduplica em UNIQUE comum).
CREATE UNIQUE INDEX "FuncaoPatente_global_uq" ON "FuncaoPatente" ("funcao_norm")
  WHERE "lotacao_id" IS NULL AND "template_id" IS NULL;
CREATE UNIQUE INDEX "FuncaoPatente_lotacao_uq" ON "FuncaoPatente" ("lotacao_id", "funcao_norm")
  WHERE "lotacao_id" IS NOT NULL AND "template_id" IS NULL;
CREATE UNIQUE INDEX "FuncaoPatente_layout_uq" ON "FuncaoPatente" ("template_id", "funcao_norm")
  WHERE "template_id" IS NOT NULL;
